import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async createNotification(
    userId: number,
    type: NotificationType,
    title: string,
    message: string,
    link?: string,
  ) {
    return this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        link,
      },
    });
  }

  async createNotificationForAllUsers(
    type: NotificationType,
    title: string,
    message: string,
    link?: string,
  ) {
    const users = await this.prisma.user.findMany({
      select: { id: true },
    });

    return this.prisma.notification.createMany({
      data: users.map((user) => ({
        userId: user.id,
        type,
        title,
        message,
        link,
      })),
    });
  }

  async createNotificationForAdmins(
    type: NotificationType,
    title: string,
    message: string,
    link?: string,
  ) {
    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true },
    });

    return this.prisma.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        type,
        title,
        message,
        link,
      })),
    });
  }

  async getUserNotifications(userId: number, limit = 20) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getUnreadCount(userId: number) {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  async markAsRead(userId: number, notificationId: number) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: number) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async deleteNotification(userId: number, notificationId: number) {
    return this.prisma.notification.deleteMany({
      where: { id: notificationId, userId },
    });
  }

  // Helper methods for specific notification types
  async notifyNewOffre(offreId: number, offreTitle: string) {
    return this.createNotificationForAllUsers(
      NotificationType.NEW_OFFRE,
      'Nouvelle offre disponible',
      `Une nouvelle offre "${offreTitle}" vient d'être publiée.`,
      `/offres/${offreId}`,
    );
  }

  async notifyNewMessage(recipientId: number, senderName: string, conversationId: number) {
    return this.createNotification(
      recipientId,
      NotificationType.NEW_MESSAGE,
      'Nouveau message',
      `${senderName} vous a envoyé un message.`,
      `/messagerie`,
    );
  }

  async notifyNewRetour(offreId: number, offreTitle: string, userName: string) {
    return this.createNotificationForAdmins(
      NotificationType.NEW_RETOUR,
      'Nouveau retour utilisateur',
      `${userName} a partagé son expérience sur l'offre "${offreTitle}".`,
      `/admin`,
    );
  }

  async notifyNewCommentaire(
    offreAuteurId: number,
    offreId: number,
    offreTitle: string,
    commenterName: string,
  ) {
    return this.createNotification(
      offreAuteurId,
      NotificationType.NEW_COMMENTAIRE,
      'Nouveau commentaire',
      `${commenterName} a commenté votre offre "${offreTitle}".`,
      `/offres/${offreId}`,
    );
  }
}
