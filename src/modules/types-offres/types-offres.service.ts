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
    const existing = await this.prisma.typeOffre.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`Le code « ${dto.code} » est déjà utilisé`);
    }

    this.assertChampsCoherents(dto.champs ?? []);

    return this.prisma.typeOffre.create({
      data: {
        code: dto.code,
        libelle: dto.libelle,
        description: dto.description,
        icone: dto.icone ?? 'Briefcase',
        couleur: dto.couleur ?? 'blue',
        ordre: dto.ordre ?? 0,
        estActif: dto.estActif ?? true,
        champs: {
          create: (dto.champs ?? []).map((champ, index) =>
            this.toChampData(champ, index),
          ),
        },
      },
      include: this.includeChamps,
    });
  }

  async update(id: number, dto: UpdateTypeOffreDto) {
    await this.findById(id);

    if (dto.champs) {
      this.assertChampsCoherents(dto.champs);
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

      if (dto.champs) {
        const gardes = dto.champs
          .map((champ) => champ.id)
          .filter((value): value is number => typeof value === 'number');

        await tx.champTypeOffre.deleteMany({
          where: { typeOffreId: id, id: { notIn: gardes.length ? gardes : [0] } },
        });

        for (const [index, champ] of dto.champs.entries()) {
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

  /* ------------------------------------------------------------- validation */

  private toChampData(champ: ChampTypeOffreDto, index: number) {
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

  private assertChampsCoherents(champs: ChampTypeOffreDto[]) {
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
