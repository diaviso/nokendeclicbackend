import { Injectable, NotFoundException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class MessagingService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
  ) {}

  // Get all conversations for a user
  async getConversations(userId: number) {
    const conversations = await this.prisma.privateConversation.findMany({
      where: {
        OR: [
          { user1Id: userId },
          { user2Id: userId },
        ],
      },
      include: {
        user1: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            pictureUrl: true,
            role: true,
          },
        },
        user2: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            pictureUrl: true,
            role: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Transform to include unread count and other user info
    const result = await Promise.all(
      conversations.map(async (conv) => {
        const otherUser = conv.user1Id === userId ? conv.user2 : conv.user1;
        const unreadCount = await this.prisma.privateMessage.count({
          where: {
            conversationId: conv.id,
            senderId: { not: userId },
            isRead: false,
          },
        });

        return {
          id: conv.id,
          otherUser,
          lastMessage: conv.messages[0] || null,
          unreadCount,
          updatedAt: conv.updatedAt,
        };
      })
    );

    return result;
  }

  // Get or create a conversation between two users
  async getOrCreateConversation(userId: number, otherUserId: number) {
    if (userId === otherUserId) {
      throw new ForbiddenException(
        'Vous ne pouvez pas démarrer une conversation avec vous-même',
      );
    }

    // La règle « un membre ne peut écrire qu'aux administrateurs » doit être
    // appliquée ICI et pas seulement dans getContactableUsers : sans ce contrôle,
    // n'importe quel membre peut ouvrir une conversation avec un autre membre en
    // devinant son identifiant.
    const [currentUser, targetUser] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      }),
      this.prisma.user.findUnique({
        where: { id: otherUserId },
        // Le CV est chargé ici : la visibilité qu'un membre a choisie est ce
        // qui autorise, ou non, un partenaire à lui écrire.
        select: {
          role: true,
          isActive: true,
          cv: { select: { estPublic: true } },
        },
      }),
    ]);

    if (!currentUser) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    if (!targetUser || !targetUser.isActive) {
      throw new NotFoundException('Destinataire non trouvé');
    }

    // Un partenaire peut écrire à un membre qui a rendu son CV visible : c'est
    // exactement ce que ce réglage promet — « les recruteurs partenaires
    // pourront le consulter ». Il ne peut pas écrire aux autres, ni un membre
    // écrire à un partenaire de sa propre initiative : la sollicitation part du
    // recruteur, et le membre garde la main en choisissant de répondre.
    const partenaireVersCandidatVisible =
      currentUser.role === 'PARTENAIRE' &&
      targetUser.role === 'MEMBRE' &&
      targetUser.cv?.estPublic === true;

    const impliqueUnAdmin =
      currentUser.role === 'ADMIN' || targetUser.role === 'ADMIN';

    if (!impliqueUnAdmin && !partenaireVersCandidatVisible) {
      // La réponse d'un membre à un partenaire reste possible : la conversation
      // existe déjà, et cette méthode n'est appelée que pour en ouvrir une.
      const dejaOuverte = await this.prisma.privateConversation.findFirst({
        where: {
          OR: [
            { user1Id: userId, user2Id: otherUserId },
            { user1Id: otherUserId, user2Id: userId },
          ],
        },
        select: { id: true },
      });

      if (!dejaOuverte) {
        throw new ForbiddenException(
          currentUser.role === 'PARTENAIRE'
            ? "Ce membre n'a pas rendu son profil visible aux recruteurs"
            : 'Vous ne pouvez contacter que les administrateurs',
        );
      }
    }

    // Ensure consistent ordering (smaller ID first)
    const [user1Id, user2Id] = userId < otherUserId
      ? [userId, otherUserId]
      : [otherUserId, userId];

    let conversation = await this.prisma.privateConversation.findUnique({
      where: {
        user1Id_user2Id: { user1Id, user2Id },
      },
      include: {
        user1: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            pictureUrl: true,
            role: true,
          },
        },
        user2: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            pictureUrl: true,
            role: true,
          },
        },
      },
    });

    if (!conversation) {
      conversation = await this.prisma.privateConversation.create({
        data: { user1Id, user2Id },
        include: {
          user1: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              pictureUrl: true,
              role: true,
            },
          },
          user2: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              pictureUrl: true,
              role: true,
            },
          },
        },
      });
    }

    const otherUser = conversation.user1Id === userId ? conversation.user2 : conversation.user1;

    return {
      id: conversation.id,
      otherUser,
      createdAt: conversation.createdAt,
    };
  }

  // Get messages for a conversation
  async getMessages(userId: number, conversationId: number, page = 1, limit = 50) {
    const conversation = await this.prisma.privateConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation non trouvée');
    }

    if (conversation.user1Id !== userId && conversation.user2Id !== userId) {
      throw new ForbiddenException('Accès non autorisé à cette conversation');
    }

    const messages = await this.prisma.privateMessage.findMany({
      where: { conversationId },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            pictureUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Mark messages as read
    await this.prisma.privateMessage.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        isRead: false,
      },
      data: { isRead: true },
    });

    return messages.reverse(); // Return in chronological order
  }

  // Send a message
  async sendMessage(userId: number, conversationId: number, content: string) {
    const conversation = await this.prisma.privateConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation non trouvée');
    }

    if (conversation.user1Id !== userId && conversation.user2Id !== userId) {
      throw new ForbiddenException('Accès non autorisé à cette conversation');
    }

    const message = await this.prisma.privateMessage.create({
      data: {
        content,
        conversationId,
        senderId: userId,
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            pictureUrl: true,
          },
        },
      },
    });

    // Update conversation timestamp
    await this.prisma.privateConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Send notification to recipient
    const recipientId = conversation.user1Id === userId ? conversation.user2Id : conversation.user1Id;
    const sender = message.sender;
    const senderName = sender.firstName ? `${sender.firstName} ${sender.lastName || ''}`.trim() : sender.username;
    await this.notificationsService.notifyNewMessage(recipientId, senderName, conversationId);

    return message;
  }

  // Delete a conversation
  async deleteConversation(userId: number, conversationId: number) {
    const conversation = await this.prisma.privateConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation non trouvée');
    }

    if (conversation.user1Id !== userId && conversation.user2Id !== userId) {
      throw new ForbiddenException('Accès non autorisé à cette conversation');
    }

    await this.prisma.privateConversation.delete({
      where: { id: conversationId },
    });

    return { message: 'Conversation supprimée' };
  }

  // Update a message
  async updateMessage(userId: number, messageId: number, content: string) {
    const message = await this.prisma.privateMessage.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message non trouvé');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('Vous ne pouvez modifier que vos propres messages');
    }

    return this.prisma.privateMessage.update({
      where: { id: messageId },
      data: { content },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            pictureUrl: true,
          },
        },
      },
    });
  }

  // Delete a message
  async deleteMessage(userId: number, messageId: number) {
    const message = await this.prisma.privateMessage.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message non trouvé');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('Vous ne pouvez supprimer que vos propres messages');
    }

    await this.prisma.privateMessage.delete({
      where: { id: messageId },
    });

    return { message: 'Message supprimé' };
  }

  // Get total unread messages count
  async getUnreadCount(userId: number) {
    const conversations = await this.prisma.privateConversation.findMany({
      where: {
        OR: [
          { user1Id: userId },
          { user2Id: userId },
        ],
      },
      select: { id: true },
    });

    const count = await this.prisma.privateMessage.count({
      where: {
        conversationId: { in: conversations.map(c => c.id) },
        senderId: { not: userId },
        isRead: false,
      },
    });

    return { unreadCount: count };
  }

  // Get users that can be messaged (admins for regular users, all users for admins)
  async getContactableUsers(userId: number) {
    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!currentUser) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    // L'administration peut écrire à tout le monde ; un partenaire, aux membres
    // qui ont rendu leur CV visible aux recruteurs, plus à l'administration ;
    // un membre, à la seule administration.
    const whereClause =
      currentUser.role === 'ADMIN'
        ? { id: { not: userId }, isActive: true }
        : currentUser.role === 'PARTENAIRE'
          ? {
              id: { not: userId },
              isActive: true,
              OR: [
                { role: 'ADMIN' as any },
                { role: 'MEMBRE' as any, cv: { estPublic: true } },
              ],
            }
          : { id: { not: userId }, role: 'ADMIN' as any, isActive: true };

    const users = await this.prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        pictureUrl: true,
        role: true,
      },
      orderBy: [
        { role: 'asc' },
        { firstName: 'asc' },
      ],
    });

    return users;
  }
}
