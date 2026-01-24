import { Injectable, NotFoundException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCommentaireDto, UpdateCommentaireDto } from './dto';
import { ModerationService } from './moderation.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class CommentairesService {
  constructor(
    private prisma: PrismaService,
    private moderationService: ModerationService,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
  ) {}

  async create(dto: CreateCommentaireDto, auteurId: number) {
    // Moderate content with AI
    const moderation = await this.moderationService.moderateContent(dto.contenu);
    
    // Get offre to find author
    const offre = await this.prisma.offre.findUnique({
      where: { id: dto.offreId },
      select: { auteurId: true, titre: true },
    });

    const commentaire = await this.prisma.commentaire.create({
      data: {
        contenu: moderation.moderatedContent,
        offreId: dto.offreId,
        auteurId,
      },
      include: {
        auteur: { select: { id: true, username: true, pictureUrl: true } },
      },
    });

    // Notify offre author about new comment (if not commenting on own offre)
    if (offre && offre.auteurId !== auteurId) {
      const commenter = await this.prisma.user.findUnique({
        where: { id: auteurId },
        select: { username: true, firstName: true },
      });
      const commenterName = commenter?.firstName || commenter?.username || 'Un utilisateur';
      await this.notificationsService.notifyNewCommentaire(
        offre.auteurId,
        dto.offreId,
        offre.titre,
        commenterName,
      );
    }

    return commentaire;
  }

  async findByOffre(offreId: number) {
    return this.prisma.commentaire.findMany({
      where: { offreId },
      include: {
        auteur: { select: { id: true, username: true, pictureUrl: true } },
      },
      orderBy: { datePublication: 'desc' },
    });
  }

  async findById(id: number) {
    const commentaire = await this.prisma.commentaire.findUnique({
      where: { id },
      include: {
        auteur: { select: { id: true, username: true, pictureUrl: true } },
      },
    });

    if (!commentaire) {
      throw new NotFoundException('Commentaire non trouvé');
    }

    return commentaire;
  }

  async update(id: number, dto: UpdateCommentaireDto, userId: number, userRole: string) {
    const commentaire = await this.prisma.commentaire.findUnique({ where: { id } });

    if (!commentaire) {
      throw new NotFoundException('Commentaire non trouvé');
    }

    if (commentaire.auteurId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('Vous ne pouvez pas modifier ce commentaire');
    }

    return this.prisma.commentaire.update({
      where: { id },
      data: { contenu: dto.contenu },
      include: {
        auteur: { select: { id: true, username: true, pictureUrl: true } },
      },
    });
  }

  async delete(id: number, userId: number, userRole: string) {
    const commentaire = await this.prisma.commentaire.findUnique({ where: { id } });

    if (!commentaire) {
      throw new NotFoundException('Commentaire non trouvé');
    }

    if (commentaire.auteurId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('Vous ne pouvez pas supprimer ce commentaire');
    }

    await this.prisma.commentaire.delete({ where: { id } });
    return { message: 'Commentaire supprimé avec succès' };
  }

  async countByOffre(offreId: number) {
    return this.prisma.commentaire.count({ where: { offreId } });
  }
}
