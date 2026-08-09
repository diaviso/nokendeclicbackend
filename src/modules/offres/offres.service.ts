import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOffreDto, UpdateOffreDto, OffresFilterDto } from './dto';
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

  async create(dto: CreateOffreDto, auteurId: number) {
    // Les valeurs des champs personnalisés sont validées contre la définition
    // du type : obligatoires présents, types respectés, clés inconnues écartées.
    const champs = await this.typesOffres.validerValeurs(
      dto.typeOffreId,
      dto.champs,
    );

    const { champs: _ignore, dateLimite, ...reste } = dto;

    const offre = await this.prisma.offre.create({
      data: {
        ...reste,
        typeEmploi: dto.typeEmploi as any,
        secteur: dto.secteur as any,
        niveauExperience: dto.niveauExperience as any,
        dateLimite: dateLimite ? new Date(dateLimite) : null,
        champs,
        auteurId,
      },
      include: { auteur: this.auteurSelect, typeOffre: this.typeSelect },
    });

    await this.notificationsService.notifyNewOffre(offre.id, offre.titre);

    return offre;
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
      data,
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

    return offre;
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
    const typeOffreId = dto.typeOffreId ?? offre.typeOffreId;
    const champs = await this.typesOffres.validerValeurs(
      typeOffreId,
      dto.champs ?? (offre.champs as Record<string, unknown>),
    );

    const { champs: _ignore, dateLimite, ...reste } = dto;

    return this.prisma.offre.update({
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
    return this.prisma.offre.findMany({
      where: { auteurId },
      orderBy: { datePublication: 'desc' },
      include: {
        typeOffre: this.typeSelect,
        _count: { select: { commentaires: true, retours: true, likes: true } },
      },
    });
  }
}
