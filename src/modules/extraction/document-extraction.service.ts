import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

/**
 * Extraction de données structurées depuis un document — image ou PDF — par un
 * modèle multimodal.
 *
 * Le document part **tel quel** au modèle, sans passer par une extraction de
 * texte préalable. C'est le point central : une couche texte n'existe pas sur un
 * scan, elle est souvent sale sur un PDF mal généré, et elle perd toujours la
 * mise en page. Un CV sur deux colonnes linéarisé devient illisible, y compris
 * pour un modèle. En voyant la page, celui-ci dispose de la structure visuelle
 * en plus des mots.
 *
 * Trois partis pris, repris de l'implémentation éprouvée du projet Tresorys :
 *
 * 1. Les PDF sont **rastérisés en images haute définition** avant l'envoi.
 *    Convertir un format textuel en image paraît absurde, mais le modèle reçoit
 *    un PDF natif en basse définition alors qu'il lit très bien une image à
 *    300 points par pouce. Repli sur le PDF natif si la rastérisation échoue.
 *
 * 2. La sortie est contrainte par un **JSON Schema strict** : l'objet renvoyé
 *    est déjà valide, il n'y a plus de expression rationnelle pour retrouver un
 *    objet dans du texte libre, ni d'analyse syntaxique susceptible d'échouer.
 *
 * 3. Un **modèle de repli** prend le relais si le premier échoue.
 */
@Injectable()
export class DocumentExtractionService {
  private readonly logger = new Logger(DocumentExtractionService.name);
  private client: OpenAI | null = null;

  /**
   * Modèle de repli. `gpt-4o` est retenu pour sa disponibilité : il gère la
   * vision et est présent sur tous les comptes, ce qui en fait un filet sûr si
   * le modèle principal est indisponible ou inconnu de l'organisation.
   */
  private static readonly MODELE_REPLI = 'gpt-4o';

  /**
   * Un CV dépasse rarement deux pages. La borne protège d'un envoi coûteux si
   * quelqu'un dépose un dossier de candidature complet à la place.
   */
  private static readonly PAGES_MAX = 4;

  constructor(private readonly configService: ConfigService) {}

  private getClient(): OpenAI {
    if (this.client) return this.client;

    const apiKey = this.configService.get<string>('openai.apiKey');
    if (!apiKey) {
      throw new InternalServerErrorException(
        "L'analyse de documents nécessite la clé OPENAI_API_KEY, absente de la configuration.",
      );
    }

    this.client = new OpenAI({ apiKey });
    return this.client;
  }

  /**
   * Rastérise un PDF en PNG, une image par page.
   *
   * `pdfjs-dist` est un module ESM : l'import doit rester dynamique et échapper
   * à la transpilation TypeScript, qui le convertirait en `require()` et
   * échouerait à l'exécution. D'où le passage par `new Function`.
   */
  private async rasteriserPdf(buffer: Buffer, echelle = 3.0): Promise<Buffer[]> {
    const importDynamique = new Function('s', 'return import(s)') as (
      s: string,
    ) => Promise<any>;

    const pdfjs = await importDynamique('pdfjs-dist/legacy/build/pdf.mjs');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createCanvas } = require('@napi-rs/canvas');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { dirname, join } = require('path');

    // Emplacement des ressources livrées avec pdfjs. Sans elles, un PDF qui
    // s'appuie sur les polices standard sans les embarquer — Helvetica, Times,
    // le cas le plus courant — est rendu avec des substituts aux métriques
    // fausses : les lettres se détachent les unes des autres et le modèle lit
    // « U n P e u p l e » au lieu de « Un Peuple ». Les jeux de caractères CJK
    // suivent la même logique pour les documents non latins.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const racinePdfjs = dirname(require.resolve('pdfjs-dist/package.json'));

    const document = await pdfjs.getDocument({
      data: new Uint8Array(buffer),
      standardFontDataUrl: join(racinePdfjs, 'standard_fonts') + '/',
      cMapUrl: join(racinePdfjs, 'cmaps') + '/',
      cMapPacked: true,
      // `disableFontFace` force le rendu par tracés plutôt que par `@font-face`,
      // inutilisable hors navigateur. `isEvalSupported` désactive l'évaluation
      // de code embarqué : un PDF reste un fichier reçu de l'extérieur.
      disableFontFace: true,
      isEvalSupported: false,
    }).promise;

    const pages: Buffer[] = [];
    const nombre = Math.min(document.numPages, DocumentExtractionService.PAGES_MAX);

    for (let i = 1; i <= nombre; i++) {
      const page = await document.getPage(i);
      const viewport = page.getViewport({ scale: echelle });
      const canvas = createCanvas(
        Math.ceil(viewport.width),
        Math.ceil(viewport.height),
      );

      await page.render({
        canvasContext: canvas.getContext('2d'),
        viewport,
        // Fond blanc explicite : un PDF sans fond produirait un PNG à canal
        // alpha, et le texte noir sur transparent devient illisible une fois
        // aplati sur un fond sombre.
        background: 'white',
      }).promise;

      pages.push(canvas.toBuffer('image/png'));
      try {
        page.cleanup();
      } catch {
        /* le nettoyage est opportuniste */
      }
    }

    try {
      await document.cleanup();
    } catch {
      /* idem */
    }

    return pages;
  }

  /** Construit les parties « document » du message multimodal. */
  private async construireParties(fichier: {
    buffer: Buffer;
    mimetype: string;
    originalname?: string;
  }): Promise<any[]> {
    const estPdf = fichier.mimetype === 'application/pdf';

    if (!estPdf) {
      return [
        {
          type: 'image_url',
          image_url: {
            url: `data:${fichier.mimetype};base64,${fichier.buffer.toString('base64')}`,
            detail: 'high',
          },
        },
      ];
    }

    try {
      const pages = await this.rasteriserPdf(fichier.buffer);
      if (pages.length) {
        this.logger.log(`PDF rastérisé en ${pages.length} image(s) haute définition.`);
        return pages.map((png) => ({
          type: 'image_url',
          image_url: {
            url: `data:image/png;base64,${png.toString('base64')}`,
            detail: 'high',
          },
        }));
      }
    } catch (error) {
      this.logger.warn(
        `Rastérisation impossible (${error instanceof Error ? error.message : String(error)}) — envoi du PDF natif.`,
      );
    }

    return [
      {
        type: 'file',
        file: {
          filename: fichier.originalname || 'document.pdf',
          file_data: `data:application/pdf;base64,${fichier.buffer.toString('base64')}`,
        },
      },
    ];
  }

  /**
   * Analyse un document et renvoie un objet conforme au schéma fourni.
   *
   * Le schéma doit être **strict** au sens d'OpenAI : chaque objet porte
   * `additionalProperties: false` et liste toutes ses clés dans `required`.
   * L'optionalité s'exprime par un type nullable (`["string", "null"]`), jamais
   * par l'absence de la clé.
   */
  async extraire<T>(params: {
    fichier: { buffer: Buffer; mimetype: string; originalname?: string };
    schema: Record<string, any>;
    nomSchema: string;
    consignes: string;
  }): Promise<T> {
    const { fichier, schema, nomSchema, consignes } = params;

    if (!fichier?.buffer?.length) {
      throw new BadRequestException('Document vide ou illisible.');
    }

    const client = this.getClient();
    const modelePrincipal =
      this.configService.get<string>('openai.visionModel') || 'gpt-4.1';

    const parties = await this.construireParties(fichier);

    const messages = [
      { role: 'system' as const, content: consignes },
      {
        role: 'user' as const,
        content: [
          {
            type: 'text',
            text: "Analyse le document ci-joint et renseigne les champs demandés. Mets `null` pour une information absente ou illisible, sans jamais l'inventer.",
          },
          ...parties,
        ],
      },
    ];

    const appeler = (modele: string) => {
      // Les modèles de raisonnement (gpt-5, série o) rejettent `temperature`.
      const raisonnement = /^(gpt-5|o\d)/i.test(modele);
      const requete: any = {
        model: modele,
        messages,
        response_format: {
          type: 'json_schema',
          json_schema: { name: nomSchema, strict: true, schema },
        },
      };
      if (!raisonnement) requete.temperature = 0;
      return client.chat.completions.create(requete);
    };

    let reponse;
    try {
      reponse = await appeler(modelePrincipal);
    } catch (erreur) {
      const message = erreur instanceof Error ? erreur.message : String(erreur);
      this.logger.warn(
        `Extraction via « ${modelePrincipal} » échouée (${message}) — repli sur « ${DocumentExtractionService.MODELE_REPLI} ».`,
      );

      if (modelePrincipal === DocumentExtractionService.MODELE_REPLI) {
        throw new InternalServerErrorException(
          "L'analyse du document a échoué. Réessayez avec un fichier plus net.",
        );
      }

      try {
        reponse = await appeler(DocumentExtractionService.MODELE_REPLI);
      } catch (erreurRepli) {
        this.logger.error(
          `Échec d'extraction après repli : ${erreurRepli instanceof Error ? erreurRepli.message : String(erreurRepli)}`,
        );
        throw new InternalServerErrorException(
          "L'analyse du document a échoué. Réessayez avec un fichier plus net.",
        );
      }
    }

    const contenu = reponse.choices?.[0]?.message?.content;
    if (!contenu) {
      throw new BadRequestException(
        "Le document n'a pas pu être analysé : aucune donnée n'en a été tirée.",
      );
    }

    try {
      return JSON.parse(contenu) as T;
    } catch {
      throw new BadRequestException("Réponse d'analyse illisible.");
    }
  }
}
