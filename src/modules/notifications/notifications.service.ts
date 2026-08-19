import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationType } from '../../generated/prisma';
import { PushService } from './push.service';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private push: PushService,
  ) {}

  /**
   * Consigne une notification et la pousse vers les appareils abonnés.
   *
   * La poussée est délibérément lancée sans être attendue : elle traverse un
   * service externe, et l'action qui l'a déclenchée — publier une offre,
   * envoyer un message — ne doit pas en dépendre. La notification reste de
   * toute façon consultable dans l'application.
   */
  async createNotification(
    userId: number,
    type: NotificationType,
    title: string,
    message: string,
    link?: string,
  ) {
    const notification = await this.prisma.notification.create({
      data: { userId, type, title, message, link },
    });

    void this.push.envoyerA(userId, {
      titre: title,
      corps: message,
      lien: link,
      // Une notification chasse la précédente de même nature : dix messages
      // non lus ne doivent pas empiler dix bandeaux sur l'écran verrouillé.
      groupe: type,
    });

    return notification;
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

    const cree = await this.prisma.notification.createMany({
      data: users.map((user) => ({
        userId: user.id,
        type,
        title,
        message,
        link,
      })),
    });

    void this.push.envoyerAPlusieurs(
      users.map((user) => user.id),
      { titre: title, corps: message, lien: link, groupe: type },
    );

    return cree;
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

    const cree = await this.prisma.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        type,
        title,
        message,
        link,
      })),
    });

    void this.push.envoyerAPlusieurs(
      admins.map((admin) => admin.id),
      { titre: title, corps: message, lien: link, groupe: type },
    );

    return cree;
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
