import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FeedbackService {
  constructor(private prisma: PrismaService) {}

  // ==================== USER ENDPOINTS ====================

  async create(userId: number, data: {
    titre: string;
    description: string;
    categorie: 'BUG' | 'AMELIORATION' | 'QUESTION' | 'AUTRE';
    pageUrl?: string;
    capture?: string;
  }) {
    return this.prisma.feedback.create({
      data: {
        titre: data.titre,
        description: data.description,
        categorie: data.categorie as any,
        pageUrl: data.pageUrl,
        capture: data.capture,
        auteurId: userId,
      },
      include: {
        auteur: {
          select: { id: true, username: true, firstName: true, lastName: true, pictureUrl: true },
        },
        _count: { select: { reponses: true } },
      },
    });
  }

  async getMyFeedbacks(userId: number, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.feedback.findMany({
        where: { auteurId: userId },
        include: {
          auteur: {
            select: { id: true, username: true, firstName: true, lastName: true, pictureUrl: true },
          },
          _count: { select: { reponses: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.feedback.count({ where: { auteurId: userId } }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(userId: number, feedbackId: number, isAdmin: boolean) {
    const feedback = await this.prisma.feedback.findUnique({
      where: { id: feedbackId },
      include: {
        auteur: {
          select: { id: true, username: true, firstName: true, lastName: true, pictureUrl: true, role: true },
        },
        reponses: {
          include: {
            auteur: {
              select: { id: true, username: true, firstName: true, lastName: true, pictureUrl: true, role: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { reponses: true } },
      },
    });

    if (!feedback) {
      throw new NotFoundException('Feedback non trouvé');
    }

    if (!isAdmin && feedback.auteurId !== userId) {
      throw new ForbiddenException('Accès non autorisé');
    }

    return feedback;
  }

  async addReponse(userId: number, feedbackId: number, contenu: string) {
    const feedback = await this.prisma.feedback.findUnique({
      where: { id: feedbackId },
    });

    if (!feedback) {
      throw new NotFoundException('Feedback non trouvé');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    const isAdmin = user?.role === 'ADMIN';

    if (!isAdmin && feedback.auteurId !== userId) {
      throw new ForbiddenException('Accès non autorisé');
    }

    const reponse = await this.prisma.feedbackReponse.create({
      data: {
        contenu,
        feedbackId,
        auteurId: userId,
      },
      include: {
        auteur: {
          select: { id: true, username: true, firstName: true, lastName: true, pictureUrl: true, role: true },
        },
      },
    });

    // Update feedback timestamp
    await this.prisma.feedback.update({
      where: { id: feedbackId },
      data: { updatedAt: new Date() },
    });

    // Notify the feedback author if an admin replied
    if (isAdmin && feedback.auteurId !== userId) {
      await this.prisma.notification.create({
        data: {
          type: 'NEW_FEEDBACK_REPONSE' as any,
          title: 'Réponse à votre feedback',
          message: `Un administrateur a répondu à votre feedback "${feedback.titre}"`,
          link: `/feedback/${feedbackId}`,
          userId: feedback.auteurId,
        },
      });
    }

    // Notify admins if a user replied
    if (!isAdmin) {
      const admins = await this.prisma.user.findMany({
        where: { role: 'ADMIN', id: { not: userId } },
        select: { id: true },
      });
      for (const admin of admins) {
        await this.prisma.notification.create({
          data: {
            type: 'NEW_FEEDBACK_REPONSE' as any,
            title: 'Nouveau message sur un feedback',
            message: `Nouvelle réponse sur le feedback "${feedback.titre}"`,
            link: `/admin/feedback/${feedbackId}`,
            userId: admin.id,
          },
        });
      }
    }

    return reponse;
  }

  // ==================== ADMIN ENDPOINTS ====================

  async getAllFeedbacks(page = 1, limit = 20, statut?: string, categorie?: string, search?: string) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (statut) where.statut = statut;
    if (categorie) where.categorie = categorie;
    if (search) {
      where.OR = [
        { titre: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { auteur: { username: { contains: search, mode: 'insensitive' } } },
        { auteur: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [data, total, stats] = await Promise.all([
      this.prisma.feedback.findMany({
        where,
        include: {
          auteur: {
            select: { id: true, username: true, firstName: true, lastName: true, pictureUrl: true, email: true },
          },
          _count: { select: { reponses: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.feedback.count({ where }),
      this.prisma.feedback.groupBy({
        by: ['statut'],
        _count: { statut: true },
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      stats: stats.reduce((acc, item) => {
        acc[item.statut] = item._count.statut;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  async updateStatus(feedbackId: number, statut: string) {
    const feedback = await this.prisma.feedback.findUnique({
      where: { id: feedbackId },
    });

    if (!feedback) {
      throw new NotFoundException('Feedback non trouvé');
    }

    const updated = await this.prisma.feedback.update({
      where: { id: feedbackId },
      data: { statut: statut as any },
      include: {
        auteur: {
          select: { id: true, username: true, firstName: true, lastName: true, pictureUrl: true },
        },
        _count: { select: { reponses: true } },
      },
    });

    // Notify author of status change
    const statusLabels: Record<string, string> = {
      OUVERT: 'ouvert',
      EN_COURS: 'en cours de traitement',
      RESOLU: 'résolu',
      FERME: 'fermé',
    };

    await this.prisma.notification.create({
      data: {
        type: 'NEW_FEEDBACK_REPONSE' as any,
        title: 'Mise à jour de votre feedback',
        message: `Votre feedback "${feedback.titre}" est maintenant ${statusLabels[statut] || statut}`,
        link: `/feedback/${feedbackId}`,
        userId: feedback.auteurId,
      },
    });

    return updated;
  }

  async updatePriority(feedbackId: number, priorite: string) {
    const feedback = await this.prisma.feedback.findUnique({
      where: { id: feedbackId },
    });

    if (!feedback) {
      throw new NotFoundException('Feedback non trouvé');
    }

    return this.prisma.feedback.update({
      where: { id: feedbackId },
      data: { priorite: priorite as any },
      include: {
        auteur: {
          select: { id: true, username: true, firstName: true, lastName: true, pictureUrl: true },
        },
        _count: { select: { reponses: true } },
      },
    });
  }

  async deleteFeedback(feedbackId: number) {
    const feedback = await this.prisma.feedback.findUnique({
      where: { id: feedbackId },
    });

    if (!feedback) {
      throw new NotFoundException('Feedback non trouvé');
    }

    await this.prisma.feedback.delete({ where: { id: feedbackId } });
    return { message: 'Feedback supprimé' };
  }
}
