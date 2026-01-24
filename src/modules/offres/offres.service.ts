import { Injectable, NotFoundException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOffreDto, UpdateOffreDto, OffresFilterDto } from './dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class OffresService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
  ) {}

  async create(dto: CreateOffreDto, auteurId: number) {
    const offre = await this.prisma.offre.create({
      data: {
        ...dto,
        typeOffre: dto.typeOffre as any,
        typeEmploi: dto.typeEmploi as any,
        secteur: dto.secteur as any,
        niveauExperience: dto.niveauExperience as any,
        dateLimite: dto.dateLimite ? new Date(dto.dateLimite) : null,
        auteurId,
      },
      include: {
        auteur: {
          select: { id: true, username: true, pictureUrl: true },
        },
      },
    });

    // Send notification to all users
    await this.notificationsService.notifyNewOffre(offre.id, offre.titre);

    return offre;
  }

  async findAll(filters: OffresFilterDto) {
    const { page = 1, limit = 20, ...filterParams } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filterParams.typeOffre) {
      where.typeOffre = filterParams.typeOffre;
    }
    if (filterParams.typeEmploi) {
      where.typeEmploi = filterParams.typeEmploi;
    }
    if (filterParams.secteur) {
      where.secteur = filterParams.secteur;
    }
    if (filterParams.niveauExperience) {
      where.niveauExperience = filterParams.niveauExperience;
    }
    if (filterParams.localisation) {
      where.localisation = { contains: filterParams.localisation, mode: 'insensitive' };
    }
    if (filterParams.tag) {
      where.tags = { has: filterParams.tag };
    }
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
          auteur: {
            select: { id: true, username: true, pictureUrl: true },
          },
          _count: {
            select: { commentaires: true, retours: true },
          },
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
        auteur: {
          select: { id: true, username: true, pictureUrl: true, email: true },
        },
        commentaires: {
          include: {
            auteur: { select: { id: true, username: true, pictureUrl: true } },
          },
          orderBy: { datePublication: 'desc' },
        },
        _count: {
          select: { commentaires: true, retours: true },
        },
      },
    });

    if (!offre) {
      throw new NotFoundException('Offre non trouvée');
    }

    // Increment view count
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

    return this.prisma.offre.update({
      where: { id },
      data: {
        ...dto,
        typeOffre: dto.typeOffre as any,
        typeEmploi: dto.typeEmploi as any,
        secteur: dto.secteur as any,
        niveauExperience: dto.niveauExperience as any,
        dateLimite: dto.dateLimite ? new Date(dto.dateLimite) : null,
      },
      include: {
        auteur: {
          select: { id: true, username: true, pictureUrl: true },
        },
      },
    });
  }

  async updateDocument(id: number, documentUrl: string, documentName: string, documentType: string) {
    return this.prisma.offre.update({
      where: { id },
      data: { documentUrl, documentName, documentType },
    });
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

  async getTypes() {
    return {
      typeOffre: ['EMPLOI', 'FORMATION', 'BOURSE'],
      typeEmploi: ['CDI', 'CDD', 'STAGE', 'ALTERNANCE', 'FREELANCE', 'INTERIM', 'SAISONNIER', 'TEMPS_PARTIEL', 'TEMPS_PLEIN'],
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

  async countByType() {
    const [emploi, formation, bourse] = await Promise.all([
      this.prisma.offre.count({ where: { typeOffre: 'EMPLOI' } }),
      this.prisma.offre.count({ where: { typeOffre: 'FORMATION' } }),
      this.prisma.offre.count({ where: { typeOffre: 'BOURSE' } }),
    ]);
    return { emploi, formation, bourse };
  }

  async countBySecteur() {
    const secteurs = await this.prisma.offre.groupBy({
      by: ['secteur'],
      _count: { secteur: true },
    });
    return secteurs;
  }

  async getTopOffres(limit = 5) {
    return this.prisma.offre.findMany({
      take: limit,
      orderBy: { retours: { _count: 'desc' } },
      include: {
        auteur: { select: { id: true, username: true } },
        _count: { select: { retours: true } },
      },
    });
  }

  async findByAuteur(auteurId: number) {
    return this.prisma.offre.findMany({
      where: { auteurId },
      orderBy: { datePublication: 'desc' },
      include: {
        _count: { select: { commentaires: true, retours: true } },
      },
    });
  }
}
