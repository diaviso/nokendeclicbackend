import { Injectable, NotFoundException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRetourDto, UpdateRetourDto, ReplyRetourDto } from './dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class RetoursService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
  ) {}

  async create(dto: CreateRetourDto, auteurId: number) {
    const retour = await this.prisma.retour.create({
      data: {
        contenu: dto.contenu,
        offreId: dto.offreId,
        auteurId,
      },
      include: {
        auteur: { select: { id: true, username: true, pictureUrl: true, firstName: true } },
        offre: { select: { id: true, titre: true } },
      },
    });

    // Notify all admins about new retour
    const userName = retour.auteur.firstName || retour.auteur.username;
    await this.notificationsService.notifyNewRetour(
      dto.offreId,
      retour.offre.titre,
      userName,
    );

    return retour;
  }

  async findByOffre(offreId: number, userId: number, userRole: string) {
    if (userRole === 'ADMIN') {
      return this.prisma.retour.findMany({
        where: { offreId },
        include: {
          auteur: { select: { id: true, username: true, email: true, pictureUrl: true } },
          reponses: {
            include: { auteur: { select: { id: true, username: true } } },
            orderBy: { dateCreation: 'asc' },
          },
        },
        orderBy: { datePublication: 'desc' },
      });
    }

    return this.prisma.retour.findMany({
      where: { offreId, auteurId: userId },
      include: {
        reponses: {
          include: { auteur: { select: { id: true, username: true } } },
          orderBy: { dateCreation: 'asc' },
        },
      },
      orderBy: { datePublication: 'desc' },
    });
  }

  async findMyRetours(userId: number) {
    return this.prisma.retour.findMany({
      where: { auteurId: userId },
      include: {
        offre: { select: { id: true, titre: true, entreprise: true } },
        reponses: {
          include: { auteur: { select: { id: true, username: true } } },
          orderBy: { dateCreation: 'asc' },
        },
      },
      orderBy: { datePublication: 'desc' },
    });
  }

  async findAll(userRole: string) {
    if (userRole !== 'ADMIN') {
      throw new ForbiddenException('Accès non autorisé');
    }

    return this.prisma.retour.findMany({
      include: {
        auteur: { select: { id: true, username: true, email: true, pictureUrl: true } },
        offre: { select: { id: true, titre: true } },
        reponses: {
          include: { auteur: { select: { id: true, username: true } } },
        },
      },
      orderBy: { datePublication: 'desc' },
    });
  }

  async findById(id: number, userId: number, userRole: string) {
    const retour = await this.prisma.retour.findUnique({
      where: { id },
      include: {
        auteur: { select: { id: true, username: true, email: true, pictureUrl: true } },
        offre: { select: { id: true, titre: true } },
        reponses: {
          include: { auteur: { select: { id: true, username: true } } },
          orderBy: { dateCreation: 'asc' },
        },
      },
    });

    if (!retour) {
      throw new NotFoundException('Retour non trouvé');
    }

    if (userRole !== 'ADMIN' && retour.auteurId !== userId) {
      throw new ForbiddenException('Accès non autorisé');
    }

    return retour;
  }

  async update(id: number, dto: UpdateRetourDto, userId: number) {
    const retour = await this.prisma.retour.findUnique({ where: { id } });

    if (!retour) {
      throw new NotFoundException('Retour non trouvé');
    }

    if (retour.auteurId !== userId) {
      throw new ForbiddenException('Vous ne pouvez pas modifier ce retour');
    }

    return this.prisma.retour.update({
      where: { id },
      data: { contenu: dto.contenu },
      include: {
        auteur: { select: { id: true, username: true, pictureUrl: true } },
      },
    });
  }

  async reply(id: number, dto: ReplyRetourDto, auteurId: number) {
    const retour = await this.prisma.retour.findUnique({ where: { id } });

    if (!retour) {
      throw new NotFoundException('Retour non trouvé');
    }

    await this.prisma.reponseRetour.create({
      data: {
        contenu: dto.contenu,
        retourId: id,
        auteurId,
      },
    });

    return this.findById(id, auteurId, 'ADMIN');
  }

  async delete(id: number, userId: number, userRole: string) {
    const retour = await this.prisma.retour.findUnique({ where: { id } });

    if (!retour) {
      throw new NotFoundException('Retour non trouvé');
    }

    if (retour.auteurId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('Vous ne pouvez pas supprimer ce retour');
    }

    await this.prisma.retour.delete({ where: { id } });
    return { message: 'Retour supprimé avec succès' };
  }

  async count() {
    return this.prisma.retour.count();
  }
}
