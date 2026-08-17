import { Injectable, Logger } from '@nestjs/common';
import { DocumentExtractionService } from '../extraction/document-extraction.service';

/** Entrée d'une rubrique non prévue par le modèle fixe du CV. */
export interface EntreeRubrique {
  titre: string;
  sousTitre?: string | null;
  periode?: string | null;
  description?: string | null;
}

export interface RubriqueLibre {
  titre: string;
  entrees: EntreeRubrique[];
}

export interface ExtractedCV {
  titreProfessionnel?: string | null;
  telephone?: string | null;
  adresse?: string | null;
  ville?: string | null;
  codePostal?: string | null;
  pays?: string | null;
  linkedin?: string | null;
  siteWeb?: string | null;
  github?: string | null;
  resume?: string | null;
  competences: string[];
  langues: string[];
  certifications: string[];
  interets: string[];
  experiences: {
    poste: string;
    entreprise: string;
    ville?: string | null;
    dateDebut: string;
    dateFin?: string | null;
    enCours: boolean;
    description?: string | null;
  }[];
  formations: {
    diplome: string;
    etablissement: string;
    ville?: string | null;
    dateDebut: string;
    dateFin?: string | null;
    enCours: boolean;
    description?: string | null;
  }[];
  /**
   * Rubriques présentes dans le document mais absentes du modèle fixe :
   * publications, projets personnels, bénévolat, distinctions, références…
   */
  rubriques: RubriqueLibre[];
}

/**
 * Lecture d'un CV déposé, par modèle multimodal.
 *
 * L'implémentation précédente extrayait la couche texte du PDF (`pdf-parse`)
 * avant de l'envoyer au modèle. Elle échouait sur trois cas courants :
 *
 * - le document scanné ou photographié n'a pas de couche texte, l'extraction
 *   renvoyait une chaîne vide et l'import s'arrêtait ;
 * - une couche texte partielle passait le contrôle de longueur, et le modèle
 *   comblait les trous en inventant — plus grave, parce que silencieux ;
 * - la mise en page était perdue, or un CV sur deux colonnes linéarisé entrelace
 *   ses colonnes et devient incompréhensible.
 *
 * Le document part désormais tel quel au modèle, qui dispose de la structure
 * visuelle en plus des mots.
 */
@Injectable()
export class CVExtractorService {
  private readonly logger = new Logger(CVExtractorService.name);

  constructor(private readonly extraction: DocumentExtractionService) {}

  /**
   * Schéma strict au sens d'OpenAI : chaque objet interdit les propriétés
   * supplémentaires et déclare toutes ses clés obligatoires. L'optionalité
   * passe par un type nullable, jamais par l'absence de clé.
   */
  private static readonly SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: [
      'titreProfessionnel',
      'telephone',
      'adresse',
      'ville',
      'codePostal',
      'pays',
      'linkedin',
      'siteWeb',
      'github',
      'resume',
      'competences',
      'langues',
      'certifications',
      'interets',
      'experiences',
      'formations',
      'rubriques',
    ],
    properties: {
      titreProfessionnel: {
        type: ['string', 'null'],
        description:
          "Titre ou poste occupé/recherché, tel qu'affiché en tête du CV.",
      },
      telephone: { type: ['string', 'null'] },
      adresse: { type: ['string', 'null'] },
      ville: { type: ['string', 'null'] },
      codePostal: { type: ['string', 'null'] },
      pays: { type: ['string', 'null'] },
      linkedin: { type: ['string', 'null'], description: 'URL du profil LinkedIn.' },
      siteWeb: { type: ['string', 'null'], description: 'Site personnel ou portfolio.' },
      github: { type: ['string', 'null'] },
      resume: {
        type: ['string', 'null'],
        description: "Résumé, profil ou objectif professionnel, s'il figure sur le CV.",
      },
      competences: {
        type: 'array',
        items: { type: 'string' },
        description: 'Compétences techniques et humaines, une par entrée.',
      },
      langues: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Langues avec leur niveau quand il est indiqué, ex. « Français (langue maternelle) », « Anglais (B2) ».',
      },
      certifications: { type: 'array', items: { type: 'string' } },
      interets: { type: 'array', items: { type: 'string' } },
      experiences: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'poste',
            'entreprise',
            'ville',
            'dateDebut',
            'dateFin',
            'enCours',
            'description',
          ],
          properties: {
            poste: { type: 'string' },
            entreprise: { type: 'string' },
            ville: { type: ['string', 'null'] },
            dateDebut: {
              type: ['string', 'null'],
              description:
                'Date de début au format AAAA-MM-JJ. Si seul le mois est donné, premier jour du mois ; si seule l\'année, AAAA-01-01.',
            },
            dateFin: {
              type: ['string', 'null'],
              description: 'Même format. null si le poste est en cours.',
            },
            enCours: { type: 'boolean' },
            description: {
              type: ['string', 'null'],
              description: 'Missions et réalisations, recopiées fidèlement.',
            },
          },
        },
      },
      formations: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'diplome',
            'etablissement',
            'ville',
            'dateDebut',
            'dateFin',
            'enCours',
            'description',
          ],
          properties: {
            diplome: { type: 'string' },
            etablissement: { type: 'string' },
            ville: { type: ['string', 'null'] },
            dateDebut: { type: ['string', 'null'] },
            dateFin: { type: ['string', 'null'] },
            enCours: { type: 'boolean' },
            description: { type: ['string', 'null'] },
          },
        },
      },
      rubriques: {
        type: 'array',
        description:
          "Rubriques du CV qui n'entrent dans AUCUN des champs ci-dessus : publications, projets personnels, bénévolat, distinctions, références, permis, engagements associatifs, etc.",
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['titre', 'entrees'],
          properties: {
            titre: {
              type: 'string',
              description: 'Intitulé de la rubrique, repris tel quel du document.',
            },
            entrees: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['titre', 'sousTitre', 'periode', 'description'],
                properties: {
                  titre: { type: 'string' },
                  sousTitre: { type: ['string', 'null'] },
                  periode: {
                    type: ['string', 'null'],
                    description: 'Période telle qu\'écrite, ex. « 2021 — 2023 ».',
                  },
                  description: { type: ['string', 'null'] },
                },
              },
            },
          },
        },
      },
    },
  };

  private static readonly CONSIGNES = [
    "Tu analyses le CV ci-joint et tu en extrais les informations de manière structurée.",
    '',
    'Règles générales :',
    "- N'invente JAMAIS une information absente ou illisible : mets `null`, ou un tableau vide.",
    '- Recopie les intitulés et descriptions tels qu\'ils figurent sur le document ; ne les reformule pas.',
    "- Le CV peut être rédigé en français ou en anglais : restitue les valeurs dans la langue du document, sans traduire.",
    '- Les dates partent au format AAAA-MM-JJ. Mois seul → premier jour du mois. Année seule → AAAA-01-01.',
    '- Trie expériences et formations de la plus récente à la plus ancienne.',
    '',
    'Mise en page :',
    "- Le CV est souvent sur deux colonnes. Lis chaque colonne dans son ordre propre : ne mélange pas une compétence de la colonne latérale avec la description d'une expérience de la colonne principale.",
    "- Si une zone est floue ou coupée, extrais ce qui est lisible et laisse le reste à `null`. Ne devine pas un nom d'entreprise à moitié effacé.",
    '',
    'Rubriques :',
    "- Range en priorité chaque information dans les champs prévus. Les intitulés varient d'un CV à l'autre : « Work Experience », « Parcours professionnel », « Expériences » désignent tous les EXPÉRIENCES ; « Education », « Études », « Cursus » désignent les FORMATIONS ; « Skills », « Savoir-faire » désignent les COMPÉTENCES. Rattache-les au bon champ.",
    "- N'utilise `rubriques` QUE pour ce qui n'entre dans aucun champ prévu : publications, projets personnels, bénévolat, distinctions, références, permis de conduire, engagements associatifs.",
    "- Ne duplique jamais dans `rubriques` une information déjà placée dans un champ prévu.",
  ].join('\n');

  /** Formats acceptés en entrée. */
  static readonly TYPES_ACCEPTES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
  ];

  /**
   * Normalise une date partiellement renseignée.
   *
   * Le modèle respecte la consigne dans la grande majorité des cas, mais rend
   * parfois « 2019 » ou « 2019-09 ». Compléter ici évite de refuser un import
   * pour une date incomplète, alors que le reste du CV est exploitable.
   */
  private normaliserDate(valeur?: string | null): string | null {
    if (!valeur) return null;
    const texte = String(valeur).trim();

    if (/^\d{4}$/.test(texte)) return `${texte}-01-01`;
    if (/^\d{4}-\d{2}$/.test(texte)) return `${texte}-01`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(texte)) return texte;

    const date = new Date(texte);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }

  /**
   * Complète une adresse web recopiée sans son schéma.
   *
   * Un CV imprime « linkedin.com/in/aminata » ou « www.exemple.sn », et le
   * modèle recopie fidèlement — c'est ce qu'on lui demande. Mais un champ de
   * saisie de type `url` refuse une valeur sans schéma, et le formulaire se
   * bloque. La normalisation appartient donc à cette couche, pas au modèle.
   */
  private normaliserUrl(valeur?: string | null): string | null {
    if (!valeur) return null;
    const texte = String(valeur).trim();
    if (!texte) return null;

    if (/^https?:\/\//i.test(texte)) return texte;
    // Un identifiant seul (« @aminata », « aminata-diallo ») n'est pas une
    // adresse : le préfixer produirait un lien mort. On le laisse tel quel.
    if (!texte.includes('.')) return texte;

    return `https://${texte.replace(/^\/+/, '')}`;
  }

  /** Retire les doublons d'une liste de libellés, à la casse et aux accents près. */
  private dedupliquer(valeurs?: string[]): string[] {
    const vus = new Set<string>();
    const resultat: string[] = [];

    for (const brut of valeurs ?? []) {
      const valeur = String(brut ?? '').trim();
      if (!valeur) continue;

      const cle = valeur
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

      if (vus.has(cle)) continue;
      vus.add(cle);
      resultat.push(valeur);
    }

    return resultat;
  }

  /**
   * Titres de rubriques déjà couverts par un champ du modèle fixe.
   *
   * Malgré la consigne, le modèle recrée parfois une rubrique « Compétences »
   * en doublon du champ dédié. Ce filtre est le garde-fou : une rubrique dont
   * le titre correspond à un champ existant est écartée plutôt que d'apparaître
   * deux fois dans le CV.
   */
  private static readonly TITRES_COUVERTS = [
    'experience',
    'experiences',
    'work experience',
    'parcours professionnel',
    'formation',
    'formations',
    'education',
    'etudes',
    'cursus',
    'competence',
    'competences',
    'skills',
    'langue',
    'langues',
    'languages',
    'certification',
    'certifications',
    'interet',
    'interets',
    'centres d interet',
    'hobbies',
    'profil',
    'resume',
    'summary',
    'contact',
  ];

  private estRubriqueCouverte(titre: string): boolean {
    const normalise = titre
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return CVExtractorService.TITRES_COUVERTS.includes(normalise);
  }

  /** Remet la sortie du modèle en ordre : dates, doublons, tri, rubriques. */
  private normaliser(brut: ExtractedCV): ExtractedCV {
    const experiences = (brut.experiences ?? [])
      .filter((e) => e?.poste || e?.entreprise)
      .map((e) => ({
        ...e,
        dateDebut: this.normaliserDate(e.dateDebut) ?? '',
        dateFin: e.enCours ? null : this.normaliserDate(e.dateFin),
      }))
      .sort((a, b) => (b.dateDebut ?? '').localeCompare(a.dateDebut ?? ''));

    const formations = (brut.formations ?? [])
      .filter((f) => f?.diplome || f?.etablissement)
      .map((f) => ({
        ...f,
        dateDebut: this.normaliserDate(f.dateDebut) ?? '',
        dateFin: f.enCours ? null : this.normaliserDate(f.dateFin),
      }))
      .sort((a, b) => (b.dateDebut ?? '').localeCompare(a.dateDebut ?? ''));

    const rubriques = (brut.rubriques ?? [])
      .filter((r) => r?.titre && !this.estRubriqueCouverte(r.titre))
      .map((r) => ({
        titre: r.titre.trim(),
        entrees: (r.entrees ?? []).filter((entree) => entree?.titre?.trim()),
      }))
      .filter((r) => r.entrees.length > 0);

    return {
      ...brut,
      linkedin: this.normaliserUrl(brut.linkedin),
      github: this.normaliserUrl(brut.github),
      siteWeb: this.normaliserUrl(brut.siteWeb),
      competences: this.dedupliquer(brut.competences),
      langues: this.dedupliquer(brut.langues),
      certifications: this.dedupliquer(brut.certifications),
      interets: this.dedupliquer(brut.interets),
      experiences,
      formations,
      rubriques,
    };
  }

  async processUploadedCV(fichier: {
    buffer: Buffer;
    mimetype: string;
    originalname?: string;
  }): Promise<ExtractedCV> {
    this.logger.log(
      `Analyse d'un CV — ${fichier.mimetype}, ${Math.round((fichier.buffer?.length ?? 0) / 1024)} Ko`,
    );

    const brut = await this.extraction.extraire<ExtractedCV>({
      fichier,
      schema: CVExtractorService.SCHEMA,
      nomSchema: 'cv',
      consignes: CVExtractorService.CONSIGNES,
    });

    const donnees = this.normaliser(brut);

    this.logger.log(
      `CV analysé : ${donnees.experiences.length} expérience(s), ${donnees.formations.length} formation(s), ${donnees.competences.length} compétence(s), ${donnees.rubriques.length} rubrique(s) libre(s).`,
    );

    return donnees;
  }
}
