import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ChampTypeOffreDto,
  CreateTypeOffreDto,
  TypeChampDto,
  UpdateTypeOffreDto,
} from './dto/type-offre.dto';

/** Valeur acceptée pour un champ personnalisé. */
type ValeurChamp = string | number | boolean | null;

@Injectable()
export class TypesOffresService {
  constructor(private prisma: PrismaService) {}

  private readonly includeChamps = {
    champs: { orderBy: { ordre: 'asc' as const } },
  };

  /** Types visibles du public : uniquement ceux activés. */
  async findAllPublic() {
    return this.prisma.typeOffre.findMany({
      where: { estActif: true },
      orderBy: [{ ordre: 'asc' }, { libelle: 'asc' }],
      include: this.includeChamps,
    });
  }

  /** Vue back-office : tous les types, avec le nombre d'offres rattachées. */
  async findAllAdmin() {
    return this.prisma.typeOffre.findMany({
      orderBy: [{ ordre: 'asc' }, { libelle: 'asc' }],
      include: {
        ...this.includeChamps,
        _count: { select: { offres: true } },
      },
    });
  }

  async findById(id: number) {
    const type = await this.prisma.typeOffre.findUnique({
      where: { id },
      include: {
        ...this.includeChamps,
        _count: { select: { offres: true } },
      },
    });
    if (!type) throw new NotFoundException("Type d'offre non trouvé");
    return type;
  }

  async findByCode(code: string) {
    const type = await this.prisma.typeOffre.findUnique({
      where: { code },
      include: this.includeChamps,
    });
    if (!type) throw new NotFoundException("Type d'offre non trouvé");
    return type;
  }

  async create(dto: CreateTypeOffreDto) {
    const code = dto.code
      ? dto.code
      : await this.genererCodeType(dto.libelle);

    const existing = await this.prisma.typeOffre.findUnique({
      where: { code },
    });
    if (existing) {
      throw new ConflictException(`Le code « ${code} » est déjà utilisé`);
    }

    const champs = this.attribuerCodesChamps(dto.champs ?? [], new Map());
    this.assertChampsCoherents(champs);

    return this.prisma.typeOffre.create({
      data: {
        code,
        libelle: dto.libelle,
        description: dto.description,
        icone: dto.icone ?? 'Briefcase',
        couleur: dto.couleur ?? 'blue',
        ordre: dto.ordre ?? 0,
        estActif: dto.estActif ?? true,
        champs: {
          create: champs.map((champ, index) => this.toChampData(champ, index)),
        },
      },
      include: this.includeChamps,
    });
  }

  async update(id: number, dto: UpdateTypeOffreDto) {
    const actuel = await this.findById(id);

    // Codes déjà en base, indexés par identifiant de champ : un champ conservé
    // garde le sien coûte que coûte. Le recalculer depuis un libellé modifié
    // orphelinerait les valeurs déjà saisies dans `Offre.champs`, qui sont
    // rangées sous l'ancien code.
    const codesExistants = new Map(
      actuel.champs.map((champ) => [champ.id, champ.code]),
    );

    const champs = dto.champs
      ? this.attribuerCodesChamps(dto.champs, codesExistants)
      : undefined;

    if (champs) {
      this.assertChampsCoherents(champs);
    }

    // La liste de champs est remplacée en bloc, dans une transaction : le
    // formulaire d'administration envoie l'état complet souhaité, et un retrait
    // de champ doit se traduire par une suppression.
    return this.prisma.$transaction(async (tx) => {
      await tx.typeOffre.update({
        where: { id },
        data: {
          libelle: dto.libelle,
          description: dto.description,
          icone: dto.icone,
          couleur: dto.couleur,
          ordre: dto.ordre,
          estActif: dto.estActif,
        },
      });

      if (champs) {
        const gardes = champs
          .map((champ) => champ.id)
          .filter((value): value is number => typeof value === 'number');

        await tx.champTypeOffre.deleteMany({
          where: { typeOffreId: id, id: { notIn: gardes.length ? gardes : [0] } },
        });

        for (const [index, champ] of champs.entries()) {
          const data = this.toChampData(champ, index);
          if (champ.id) {
            await tx.champTypeOffre.update({ where: { id: champ.id }, data });
          } else {
            await tx.champTypeOffre.create({
              data: { ...data, typeOffreId: id },
            });
          }
        }
      }

      return tx.typeOffre.findUnique({
        where: { id },
        include: this.includeChamps,
      });
    });
  }

  async remove(id: number) {
    const type = await this.findById(id);

    // Suppression refusée tant que des offres y sont rattachées : la contrainte
    // de clé étrangère est en RESTRICT, autant renvoyer un message utile plutôt
    // qu'une erreur de base. Désactiver le type est l'alternative.
    if (type._count.offres > 0) {
      throw new ConflictException(
        `Ce type est utilisé par ${type._count.offres} offre(s). ` +
          'Désactivez-le pour le retirer des formulaires sans supprimer les offres existantes.',
      );
    }

    await this.prisma.typeOffre.delete({ where: { id } });
    return { message: "Type d'offre supprimé" };
  }

  /* ------------------------------------------------------- codes techniques */

  /**
   * Réduit un libellé à ses lettres et chiffres, mot par mot.
   *
   * « Pays d'accueil » donne ['Pays', 'd', 'accueil'] : les accents sont
   * décomposés par NFD puis leurs marques retirées, et tout ce qui n'est pas
   * alphanumérique fait office de séparateur.
   */
  private motsDuLibelle(libelle: string): string[] {
    return libelle
      .normalize('NFD')
      // Marques diacritiques combinantes produites par NFD : « é » devient
      // « e » suivi de U+0301. Écrites en points de code, jamais en clair :
      // un caractère combinant collé au crochet du motif est illisible et se
      // perd à la moindre conversion d'encodage.
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  }

  /**
   * Code d'un type : le libellé en majuscules, mots joints par un tiret bas.
   *
   * Un suffixe numérique est ajouté tant que le code est pris — deux types
   * peuvent légitimement porter des noms voisins, et c'est ici, face à la base,
   * qu'on le sait. Le formulaire, lui, ignore ce qui existe déjà.
   */
  private async genererCodeType(libelle: string): Promise<string> {
    const mots = this.motsDuLibelle(libelle);
    const base =
      mots
        .join('_')
        .toUpperCase()
        .replace(/^[^A-Z]+/, '')
        .slice(0, 36) || 'TYPE';

    for (let suffixe = 0; suffixe < 100; suffixe += 1) {
      const candidat = suffixe === 0 ? base : `${base}_${suffixe + 1}`;
      const pris = await this.prisma.typeOffre.findUnique({
        where: { code: candidat },
        select: { id: true },
      });
      if (!pris) return candidat;
    }

    throw new ConflictException(
      `Impossible de dériver un code libre depuis « ${libelle} ». Choisissez un autre nom.`,
    );
  }

  /**
   * Code d'un champ : le libellé en casse chameau — « Pays d'accueil » devient
   * `paysDAccueil`.
   */
  private genererCodeChamp(libelle: string): string {
    const mots = this.motsDuLibelle(libelle);
    if (!mots.length) return 'champ';

    const camel =
      mots[0].toLowerCase() +
      mots
        .slice(1)
        .map((mot) => mot[0].toUpperCase() + mot.slice(1).toLowerCase())
        .join('');

    // Le code doit commencer par une lettre : un libellé purement numérique
    // (« 2026 ») produirait sinon un identifiant invalide.
    return (/^[a-zA-Z]/.test(camel) ? camel : `champ${camel}`).slice(0, 40);
  }

  /**
   * Attribue son code à chaque champ soumis.
   *
   * Trois règles, dans cet ordre : un champ déjà enregistré garde le code qu'il
   * a en base ; un code explicitement fourni est respecté ; sinon le libellé le
   * détermine. Les collisions au sein du type sont levées par un suffixe, car
   * deux champs peuvent légitimement s'appeler « Durée » dans deux sections.
   */
  private attribuerCodesChamps(
    champs: ChampTypeOffreDto[],
    codesExistants: Map<number, string>,
  ): (ChampTypeOffreDto & { code: string })[] {
    const pris = new Set<string>();

    // Les codes conservés sont réservés en premier : un champ existant ne doit
    // jamais céder son code à un nouveau venu traité avant lui.
    for (const champ of champs) {
      const conserve = champ.id ? codesExistants.get(champ.id) : undefined;
      if (conserve) pris.add(conserve.toLowerCase());
    }

    return champs.map((champ) => {
      const conserve = champ.id ? codesExistants.get(champ.id) : undefined;
      if (conserve) return { ...champ, code: conserve };

      const souhaite = champ.code?.trim() || this.genererCodeChamp(champ.libelle);

      let code = souhaite;
      let suffixe = 2;
      while (pris.has(code.toLowerCase())) {
        code = `${souhaite.slice(0, 37)}${suffixe}`;
        suffixe += 1;
      }

      pris.add(code.toLowerCase());
      return { ...champ, code };
    });
  }

  /* ------------------------------------------------------------- validation */

  private toChampData(champ: ChampTypeOffreDto & { code: string }, index: number) {
    return {
      code: champ.code,
      libelle: champ.libelle,
      type: champ.type,
      obligatoire: champ.obligatoire ?? false,
      options: champ.type === TypeChampDto.LISTE ? (champ.options ?? []) : [],
      placeholder: champ.placeholder,
      aide: champ.aide,
      ordre: champ.ordre ?? index,
    };
  }

  private assertChampsCoherents(champs: (ChampTypeOffreDto & { code: string })[]) {
    const codes = new Set<string>();
    for (const champ of champs) {
      if (codes.has(champ.code)) {
        throw new BadRequestException(
          `Le code de champ « ${champ.code} » est présent deux fois`,
        );
      }
      codes.add(champ.code);

      if (champ.type === TypeChampDto.LISTE && !champ.options?.length) {
        throw new BadRequestException(
          `Le champ « ${champ.libelle} » est une liste : il doit proposer au moins une option`,
        );
      }
    }
  }

  /**
   * Valide et normalise les valeurs soumises pour une offre.
   *
   * Renvoie un objet ne contenant que les champs définis par le type : une clé
   * inconnue est ignorée plutôt que stockée, sans quoi le JSON accumulerait des
   * résidus à chaque changement de définition.
   */
  async validerValeurs(
    typeOffreId: number,
    valeurs: Record<string, unknown> | undefined,
  ): Promise<Record<string, ValeurChamp>> {
    const type = await this.prisma.typeOffre.findUnique({
      where: { id: typeOffreId },
      include: this.includeChamps,
    });

    if (!type) {
      throw new BadRequestException("Type d'offre inconnu");
    }
    if (!type.estActif) {
      throw new BadRequestException(
        `Le type « ${type.libelle} » est désactivé et ne peut plus être utilisé`,
      );
    }

    const source = valeurs ?? {};
    const resultat: Record<string, ValeurChamp> = {};
    const erreurs: string[] = [];

    for (const champ of type.champs) {
      const brute = source[champ.code];
      const vide =
        brute === undefined ||
        brute === null ||
        (typeof brute === 'string' && brute.trim() === '');

      if (vide) {
        if (champ.obligatoire) {
          erreurs.push(`« ${champ.libelle} » est obligatoire`);
        }
        continue;
      }

      try {
        resultat[champ.code] = this.normaliser(champ, brute);
      } catch (error) {
        erreurs.push(
          error instanceof Error ? error.message : `« ${champ.libelle} » est invalide`,
        );
      }
    }

    if (erreurs.length) {
      throw new BadRequestException(erreurs);
    }

    return resultat;
  }

  private normaliser(
    champ: { code: string; libelle: string; type: string; options: string[] },
    valeur: unknown,
  ): ValeurChamp {
    switch (champ.type) {
      case TypeChampDto.NOMBRE: {
        const nombre = typeof valeur === 'number' ? valeur : Number(valeur);
        if (!Number.isFinite(nombre)) {
          throw new Error(`« ${champ.libelle} » doit être un nombre`);
        }
        return nombre;
      }

      case TypeChampDto.BOOLEEN:
        // Un formulaire HTML transmet volontiers "true"/"false" en chaîne.
        if (typeof valeur === 'boolean') return valeur;
        if (valeur === 'true') return true;
        if (valeur === 'false') return false;
        throw new Error(`« ${champ.libelle} » doit être oui ou non`);

      case TypeChampDto.DATE: {
        const date = new Date(String(valeur));
        if (Number.isNaN(date.getTime())) {
          throw new Error(`« ${champ.libelle} » doit être une date valide`);
        }
        // Stockée en ISO : comparable et indépendante du fuseau d'affichage.
        return date.toISOString();
      }

      case TypeChampDto.LISTE: {
        const texte = String(valeur);
        if (!champ.options.includes(texte)) {
          throw new Error(
            `« ${champ.libelle} » doit être l'une des valeurs proposées`,
          );
        }
        return texte;
      }

      case TypeChampDto.URL: {
        const texte = String(valeur).trim();
        try {
          const url = new URL(texte);
          if (!['http:', 'https:'].includes(url.protocol)) {
            throw new Error('protocole');
          }
        } catch {
          throw new Error(
            `« ${champ.libelle} » doit être une adresse web valide (http ou https)`,
          );
        }
        return texte;
      }

      case TypeChampDto.TEXTE_LONG: {
        const texte = String(valeur).trim();
        if (texte.length > 5000) {
          throw new Error(`« ${champ.libelle} » dépasse 5000 caractères`);
        }
        return texte;
      }

      default: {
        const texte = String(valeur).trim();
        if (texte.length > 500) {
          throw new Error(`« ${champ.libelle} » dépasse 500 caractères`);
        }
        return texte;
      }
    }
  }
}
