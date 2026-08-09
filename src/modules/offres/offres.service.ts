import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CHAMPS_LEGACY, CreateOffreDto, UpdateOffreDto, OffresFilterDto } from './dto';
import { NotificationsService } from '../notifications/notifications.service';
import { TypesOffresService } from '../types-offres/types-offres.service';

@Injectable()
export class OffresService {
  constructor(
    private prisma: PrismaService,
    private typesOffres: TypesOffresService,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
  ) {}

  /** Projection du type jointe à chaque offre : le front en a besoin pour
   *  l'affichage (libellé, icône, couleur) et pour rendre les champs. */
  private readonly typeSelect = {
    select: {
      id: true,
      code: true,
      libelle: true,
      icone: true,
      couleur: true,
      champs: {
        orderBy: { ordre: 'asc' as const },
        select: {
          id: true,
          code: true,
          libelle: true,
          type: true,
          obligatoire: true,
          options: true,
          aide: true,
          ordre: true,
        },
      },
    },
  };

  private readonly auteurSelect = {
    select: { id: true, username: true, pictureUrl: true },
  };

  /**
   * Met la réponse à la forme attendue par les deux frontends.
   *
   * `typeOffre` reste une **chaîne** (le code) : c'est ce que lisent l'ancien
   * front Vite — qui l'utilise comme clé de ses tables de libellés — et le
   * nouveau. Renvoyer l'objet sous ce nom ferait disparaître silencieusement
   * toutes les pastilles de type sur une application en production.
   *
   * L'objet complet (libellé, icône, couleur, définition des champs) est
   * exposé sous `type`, que seul le nouveau front consomme.
   *
   * Les anciennes colonnes spécifiques sont par ailleurs remontées à plat
   * depuis `champs`, pour que l'ancien front continue d'afficher salaire,
   * organisme ou pays de bourse. À retirer une fois l'ancien front déposé.
   */
  private serialiser<T extends Record<string, any>>(offre: T) {
    if (!offre) return offre;

    const { typeOffre, champs, ...reste } = offre;
    const valeurs = (champs ?? {}) as Record<string, unknown>;

    return {
      ...reste,
      ...valeurs,
      champs: valeurs,
      typeOffre: typeOffre?.code ?? null,
      type: typeOffre ?? null,
    };
  }

  /**
   * Résout le type et les valeurs de champs à partir d'une requête, qu'elle
   * vienne du nouveau front (`typeOffreId` + `champs`) ou de l'ancien
   * (`typeOffre` en code + champs spécifiques à plat).
   */
  private async resoudreEntree(
    dto: CreateOffreDto | UpdateOffreDto,
    typeParDefaut?: number,
  ) {
    let typeOffreId = dto.typeOffreId ?? typeParDefaut;

    if (!typeOffreId && dto.typeOffre) {
      const type = await this.prisma.typeOffre.findUnique({
        where: { code: dto.typeOffre.toUpperCase() },
        select: { id: true },
      });
      if (!type) {
        throw new NotFoundException(
          `Type d'offre « ${dto.typeOffre} » introuvable`,
        );
      }
      typeOffreId = type.id;
    }

    if (!typeOffreId) {
      throw new BadRequestException("Le type d'offre est requis");
    }

    // Champs hérités envoyés à plat : repliés dans `champs`, sans écraser une
    // valeur explicitement fournie sous la nouvelle forme.
    const heritees: Record<string, unknown> = {};
    const brut = dto as unknown as Record<string, unknown>;
    for (const code of CHAMPS_LEGACY) {
      const valeur = brut[code];
      if (valeur !== undefined && valeur !== null && valeur !== '') {
        heritees[code] = valeur;
      }
    }

    const champs = await this.typesOffres.validerValeurs(typeOffreId, {
      ...heritees,
      ...(dto.champs ?? {}),
    });

    return { typeOffreId, champs };
  }

  /** Retire du DTO les clés qui ne sont pas des colonnes de la table. */
  private sansClesNonColonnes(dto: CreateOffreDto | UpdateOffreDto) {
    const reste = { ...(dto as unknown as Record<string, unknown>) };

    for (const cle of ['champs', 'typeOffre', 'typeOffreId', 'dateLimite']) {
      delete reste[cle];
    }
    for (const code of CHAMPS_LEGACY) {
      delete reste[code];
    }

    return reste as Omit<
      CreateOffreDto,
      'champs' | 'typeOffre' | 'typeOffreId' | 'dateLimite'
    >;
  }

  async create(dto: CreateOffreDto, auteurId: number) {
    // Les valeurs sont validées contre la définition du type : obligatoires
    // présents, types respectés, clés inconnues écartées.
    const { typeOffreId, champs } = await this.resoudreEntree(dto);
    const reste = this.sansClesNonColonnes(dto);
    const dateLimite = dto.dateLimite;

    const offre = await this.prisma.offre.create({
      data: {
        ...reste,
        typeOffreId,
        typeEmploi: dto.typeEmploi as any,
        secteur: dto.secteur as any,
        niveauExperience: dto.niveauExperience as any,
        dateLimite: dateLimite ? new Date(dateLimite) : null,
        champs,
        auteurId,
      } as any,
      include: { auteur: this.auteurSelect, typeOffre: this.typeSelect },
    });

    await this.notificationsService.notifyNewOffre(offre.id, offre.titre);

    return this.serialiser(offre);
  }

  async findAll(filters: OffresFilterDto) {
    const { page = 1, limit = 20, ...filterParams } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};

    // Le filtre accepte le code (liens partagés) ou l'identifiant.
    if (filterParams.typeOffreId) {
      where.typeOffreId = filterParams.typeOffreId;
    } else if (filterParams.typeOffre) {
      where.typeOffre = { code: filterParams.typeOffre.toUpperCase() };
    }

    if (filterParams.typeEmploi) where.typeEmploi = filterParams.typeEmploi;
    if (filterParams.secteur) where.secteur = filterParams.secteur;
    if (filterParams.niveauExperience) {
      where.niveauExperience = filterParams.niveauExperience;
    }
    if (filterParams.localisation) {
      where.localisation = {
        contains: filterParams.localisation,
        mode: 'insensitive',
      };
    }
    if (filterParams.tag) where.tags = { has: filterParams.tag };
    if (filterParams.keyword) {
      where.OR = [
        { titre: { contains: filterParams.keyword, mode: 'insensitive' } },
        { description: { contains: filterParams.keyword, mode: 'insensitive' } },
        { entreprise: { contains: filterParams.keyword, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.offre.findMany({
        where,
        skip,
        take: limit,
        orderBy: { datePublication: 'desc' },
        include: {
          auteur: this.auteurSelect,
          typeOffre: this.typeSelect,
          _count: { select: { commentaires: true, retours: true, likes: true } },
        },
      }),
      this.prisma.offre.count({ where }),
    ]);

    return {
      data: data.map((offre) => this.serialiser(offre)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + data.length < total,
    };
  }

  async findById(id: number) {
    const offre = await this.prisma.offre.findUnique({
      where: { id },
      include: {
        // Pas d'email : cette route est publique (rendu serveur des pages
        // d'offres). L'adresse de l'auteur reste accessible aux administrateurs
        // via GET /api/admin/offres/:id.
        auteur: this.auteurSelect,
        typeOffre: this.typeSelect,
        commentaires: {
          include: {
            auteur: { select: { id: true, username: true, pictureUrl: true } },
          },
          orderBy: { datePublication: 'desc' },
        },
        fichiers: { orderBy: { createdAt: 'desc' } },
        _count: { select: { commentaires: true, retours: true, likes: true } },
      },
    });

    if (!offre) {
      throw new NotFoundException('Offre non trouvée');
    }

    await this.prisma.offre.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });

    return this.serialiser(offre);
  }

  async update(id: number, dto: UpdateOffreDto, userId: number, userRole: string) {
    const offre = await this.prisma.offre.findUnique({ where: { id } });

    if (!offre) {
      throw new NotFoundException('Offre non trouvée');
    }

    if (offre.auteurId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('Vous ne pouvez pas modifier cette offre');
    }

    // Le type peut changer : les valeurs sont revalidées contre la définition
    // du type cible, ce qui écarte au passage les champs de l'ancien type.
    const { typeOffreId, champs } = await this.resoudreEntree(
      {
        ...dto,
        // Sans valeurs fournies, on repart de celles déjà enregistrées : une
        // mise à jour partielle ne doit pas vider les champs du type.
        champs: dto.champs ?? (offre.champs as Record<string, unknown>),
      },
      offre.typeOffreId,
    );

    const reste = this.sansClesNonColonnes(dto);
    const dateLimite = dto.dateLimite;

    const misAJour = await this.prisma.offre.update({
      where: { id },
      data: {
        ...reste,
        typeOffreId,
        typeEmploi: dto.typeEmploi as any,
        secteur: dto.secteur as any,
        niveauExperience: dto.niveauExperience as any,
        dateLimite: dateLimite ? new Date(dateLimite) : null,
        champs,
      },
      include: { auteur: this.auteurSelect, typeOffre: this.typeSelect },
    });

    return this.serialiser(misAJour);
  }

  /**
   * Met à jour la photo de couverture ou le document principal.
   *
   * `userId` est optionnel : les appels internes (création avec document, où
   * l'appartenance vient d'être établie) le laissent de côté, les endpoints
   * exposés le fournissent pour que l'autorisation soit vérifiée ici plutôt
   * que dupliquée dans le contrôleur.
   */
  async updateMedia(
    id: number,
    data: {
      imageUrl?: string | null;
      documentUrl?: string | null;
      documentName?: string | null;
      documentType?: string | null;
    },
    auteur?: { userId: number; userRole: string },
  ) {
    if (auteur) {
      const offre = await this.prisma.offre.findUnique({
        where: { id },
        select: { auteurId: true },
      });
      if (!offre) throw new NotFoundException('Offre non trouvée');
      if (offre.auteurId !== auteur.userId && auteur.userRole !== 'ADMIN') {
        throw new ForbiddenException('Vous ne pouvez pas modifier cette offre');
      }
    }

    return this.prisma.offre.update({ where: { id }, data });
  }

  async delete(id: number, userId: number, userRole: string) {
    const offre = await this.prisma.offre.findUnique({ where: { id } });

    if (!offre) {
      throw new NotFoundException('Offre non trouvée');
    }

    if (offre.auteurId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('Vous ne pouvez pas supprimer cette offre');
    }

    await this.prisma.offre.delete({ where: { id } });
    return { message: 'Offre supprimée avec succès' };
  }

  /**
   * Référentiel des valeurs proposées dans les formulaires.
   * Les types viennent désormais de la base ; les autres restent des
   * énumérations du schéma.
   */
  async getTypes() {
    const typeOffre = await this.prisma.typeOffre.findMany({
      where: { estActif: true },
      orderBy: [{ ordre: 'asc' }, { libelle: 'asc' }],
      select: { id: true, code: true, libelle: true, icone: true, couleur: true },
    });

    return {
      typeOffre,
      typeEmploi: [
        'CDI', 'CDD', 'STAGE', 'ALTERNANCE', 'FREELANCE', 'INTERIM',
        'SAISONNIER', 'TEMPS_PARTIEL', 'TEMPS_PLEIN',
      ],
      secteur: [
        'INFORMATIQUE', 'FINANCE', 'SANTE', 'EDUCATION', 'COMMERCE', 'INDUSTRIE',
        'AGRICULTURE', 'TOURISME', 'TRANSPORT', 'COMMUNICATION', 'ADMINISTRATION',
        'ARTISANAT', 'CONSTRUCTION', 'ENERGIE', 'ENVIRONNEMENT', 'JURIDIQUE',
        'MARKETING', 'RESSOURCES_HUMAINES', 'RECHERCHE', 'AUTRE',
      ],
      niveauExperience: ['DEBUTANT', 'JUNIOR', 'CONFIRME', 'SENIOR', 'EXPERT'],
    };
  }

  async count() {
    return this.prisma.offre.count();
  }

  /** Comptage par type — dérivé de la table, plus d'une liste figée. */
  async countByType() {
    const groupes = await this.prisma.offre.groupBy({
      by: ['typeOffreId'],
      _count: { typeOffreId: true },
    });

    const types = await this.prisma.typeOffre.findMany({
      select: { id: true, code: true, libelle: true },
    });

    return types.map((type) => ({
      id: type.id,
      code: type.code,
      libelle: type.libelle,
      count:
        groupes.find((g) => g.typeOffreId === type.id)?._count.typeOffreId ?? 0,
    }));
  }

  async countBySecteur() {
    return this.prisma.offre.groupBy({
      by: ['secteur'],
      _count: { secteur: true },
    });
  }

  async getTopOffres(limit = 5) {
    return this.prisma.offre.findMany({
      take: limit,
      orderBy: { retours: { _count: 'desc' } },
      include: {
        auteur: { select: { id: true, username: true } },
        typeOffre: { select: { code: true, libelle: true } },
        _count: { select: { retours: true } },
      },
    });
  }

  async findByAuteur(auteurId: number) {
    const offres = await this.prisma.offre.findMany({
      where: { auteurId },
      orderBy: { datePublication: 'desc' },
      include: {
        typeOffre: this.typeSelect,
        _count: { select: { commentaires: true, retours: true, likes: true } },
      },
    });

    return offres.map((offre) => this.serialiser(offre));
  }
}
