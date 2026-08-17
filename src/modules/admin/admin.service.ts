import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
  ) {}

  /**
   * Projection du type d'offre — libellé, icône et couleur, sans la définition
   * des champs : la console d'administration affiche une pastille par ligne,
   * pas un formulaire, et charger les champs de vingt types par page serait
   * payé à chaque affichage de la liste.
   */
  private static readonly TYPE_SELECT = {
    select: {
      id: true,
      code: true,
      libelle: true,
      icone: true,
      couleur: true,
    },
  };

  /**
   * Met une offre à la forme attendue par les frontends, comme le fait
   * `OffresService.serialiser`.
   *
   * `typeOffre` doit rester une **chaîne** — le code — car c'est la clé que les
   * deux frontends utilisent pour retrouver libellé et couleur ; l'objet complet
   * est exposé sous `type`. Ce module avait été oublié lors du passage aux types
   * administrables : il renvoyait la relation brute sous `typeOffre`, si bien
   * que la colonne « Type » de la console restait vide.
   */
  private static serialiserOffre<T extends Record<string, any>>(offre: T) {
    if (!offre) return offre;

    const { typeOffre, ...reste } = offre;

    return {
      ...reste,
      typeOffre: typeOffre?.code ?? null,
      type: typeOffre ?? null,
    };
  }

  // ==================== USERS ====================

  async getAllUsers(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;
    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { username: { contains: search, mode: 'insensitive' as const } },
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          statutProfessionnel: true,
          pictureUrl: true,
          createdAt: true,
          _count: { select: { retours: true, offres: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getAllUsersForExport() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        statutProfessionnel: true,
        telephone: true,
        region: true,
        departement: true,
        commune: true,
        createdAt: true,
        _count: { select: { retours: true, offres: true } },
      },
    });
  }

  async getUserById(id: number) {
    // IMPORTANT: projection explicite. Ne jamais utiliser `include` seul ici :
    // Prisma retournerait alors TOUS les champs scalaires de User, y compris
    // `password` (hash bcrypt) et `refreshToken` (rejouable sur /auth/refresh).
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        isEmailVerified: true,
        isGoogleLogin: true,
        pictureUrl: true,
        statutProfessionnel: true,
        pays: true,
        region: true,
        departement: true,
        commune: true,
        sexe: true,
        dateNaissance: true,
        adresse: true,
        telephone: true,
        handicap: true,
        typeHandicap: true,
        createdAt: true,
        updatedAt: true,
        // Champs volontairement exclus : password, refreshToken, googleId.
        cv: {
          include: {
            experiences: { orderBy: { dateDebut: 'desc' } },
            formations: { orderBy: { dateDebut: 'desc' } },
          },
        },
        retours: {
          take: 10,
          orderBy: { datePublication: 'desc' },
          include: {
            offre: { select: { id: true, titre: true } },
            _count: { select: { reponses: true } },
          },
        },
        offres: {
          take: 10,
          orderBy: { datePublication: 'desc' },
          include: {
            typeOffre: AdminService.TYPE_SELECT,
            _count: { select: { retours: true, commentaires: true } },
          },
        },
        favorites: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            offre: {
              select: {
                id: true,
                titre: true,
                entreprise: true,
                estCloturee: true,
                typeOffre: AdminService.TYPE_SELECT,
              },
            },
          },
        },
        likes: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            offre: {
              select: { id: true, titre: true, typeOffre: AdminService.TYPE_SELECT },
            },
          },
        },
        commentaires: {
          take: 10,
          orderBy: { datePublication: 'desc' },
          include: { offre: { select: { id: true, titre: true } } },
        },
        feedbacks: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            titre: true,
            categorie: true,
            statut: true,
            priorite: true,
            createdAt: true,
            _count: { select: { reponses: true } },
          },
        },
        alerts: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            criteria: true,
            isActive: true,
            lastSent: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            retours: true,
            offres: true,
            favorites: true,
            likes: true,
            commentaires: true,
            feedbacks: true,
            alerts: true,
            notifications: true,
            conversations: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    // Get AI chatbot stats
    const conversations = await this.prisma.conversation.findMany({
      where: { userId: id },
      include: {
        _count: { select: { messages: true } },
      },
    });

    const totalConversations = conversations.length;
    const totalMessages = conversations.reduce((sum, conv) => sum + conv._count.messages, 0);
    const lastConversation = conversations.length > 0 
      ? conversations.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0]
      : null;

    // Get message breakdown (user vs assistant)
    const messageStats = await this.prisma.chatMessage.groupBy({
      by: ['role'],
      where: {
        conversation: { userId: id },
      },
      _count: { role: true },
    });

    const userMessages = messageStats.find(s => s.role === 'user')?._count?.role || 0;
    const assistantMessages = messageStats.find(s => s.role === 'assistant')?._count?.role || 0;

    // Get private messaging stats
    const privateConversations = await this.prisma.privateConversation.count({
      where: {
        OR: [{ user1Id: id }, { user2Id: id }],
      },
    });

    const privateMessagesSent = await this.prisma.privateMessage.count({
      where: { senderId: id },
    });

    const privateMessagesReceived = await this.prisma.privateMessage.count({
      where: {
        conversation: {
          OR: [{ user1Id: id }, { user2Id: id }],
        },
        NOT: { senderId: id },
      },
    });

    // Notifications non lues et dernières reçues : elles disent ce que la
    // plateforme a tenté d'adresser au compte, information utile quand un
    // membre écrit « je n'ai rien reçu ».
    const [notificationsNonLues, dernieresNotifications, derniereConnexionMessage] =
      await Promise.all([
        this.prisma.notification.count({ where: { userId: id, isRead: false } }),
        this.prisma.notification.findMany({
          where: { userId: id },
          take: 8,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            type: true,
            title: true,
            message: true,
            isRead: true,
            createdAt: true,
          },
        }),
        this.prisma.privateMessage.findFirst({
          where: { senderId: id },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
      ]);

    // Dernier signe de vie observable, toutes surfaces confondues. `updatedAt`
    // seul est trompeur : il bouge à chaque modification du profil, y compris
    // faite depuis la console par un administrateur.
    const derniereActivite = [
      derniereConnexionMessage?.createdAt,
      lastConversation?.updatedAt,
      user.retours[0]?.datePublication,
      user.offres[0]?.datePublication,
      user.commentaires[0]?.datePublication,
      user.feedbacks[0]?.createdAt,
      user.favorites[0]?.createdAt,
      user.likes[0]?.createdAt,
    ]
      .filter((date): date is Date => Boolean(date))
      .sort((a, b) => b.getTime() - a.getTime())[0];

    return {
      ...user,
      derniereActivite: derniereActivite ?? null,
      dernieresNotifications,
      aiChatStats: {
        totalConversations,
        totalMessages,
        userMessages,
        assistantMessages,
        lastConversationDate: lastConversation?.updatedAt || null,
      },
      messagingStats: {
        privateConversations,
        privateMessagesSent,
        privateMessagesReceived,
      },
      engagementStats: {
        alertsCount: user._count.alerts,
        commentsCount: user._count.commentaires,
        likesCount: user._count.likes,
        feedbacksCount: user._count.feedbacks,
        notificationsCount: user._count.notifications,
        notificationsNonLues,
      },
    };
  }

  async updateUserRole(id: number, role: string) {
    return this.prisma.user.update({
      where: { id },
      data: { role: role as any },
    });
  }

  async toggleUserActive(id: number, isActive: boolean) {
    return this.prisma.user.update({
      where: { id },
      data: { isActive },
    });
  }

  async deleteUser(id: number) {
    await this.prisma.user.delete({ where: { id } });
    return { message: 'Utilisateur supprimé avec succès' };
  }

  // ==================== OFFRES ====================

  async getAllOffres(page = 1, limit = 20, search?: string, typeOffre?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (search) {
      where.OR = [
        { titre: { contains: search, mode: 'insensitive' } },
        { entreprise: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (typeOffre) {
      // Le filtre porte sur le code du type, via la relation : depuis que les
      // types sont administrables, `Offre` ne porte plus de colonne `typeOffre`
      // mais une clé étrangère `typeOffreId`. Filtrer sur l'ancien nom faisait
      // échouer la requête dès qu'un type était sélectionné.
      where.typeOffre = { code: typeOffre.toUpperCase() };
    }

    const [offres, total] = await Promise.all([
      this.prisma.offre.findMany({
        where,
        skip,
        take: limit,
        orderBy: { datePublication: 'desc' },
        include: {
          auteur: { select: { id: true, username: true, email: true } },
          typeOffre: AdminService.TYPE_SELECT,
          _count: { select: { retours: true, commentaires: true } },
        },
      }),
      this.prisma.offre.count({ where }),
    ]);

    return {
      data: offres.map((offre) => AdminService.serialiserOffre(offre)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getAllOffresForExport() {
    const offres = await this.prisma.offre.findMany({
      orderBy: { datePublication: 'desc' },
      include: {
        auteur: { select: { id: true, username: true, email: true } },
        typeOffre: AdminService.TYPE_SELECT,
        _count: { select: { retours: true } },
      },
    });

    return offres.map((offre) => AdminService.serialiserOffre(offre));
  }

  async getOffreById(id: number) {
    const offre = await this.prisma.offre.findUnique({
      where: { id },
      include: {
        auteur: { select: { id: true, username: true, email: true } },
        typeOffre: AdminService.TYPE_SELECT,
        retours: {
          take: 10,
          orderBy: { datePublication: 'desc' },
          include: { auteur: { select: { id: true, username: true } } },
        },
        _count: { select: { retours: true } },
      },
    });

    if (!offre) {
      throw new NotFoundException('Offre non trouvée');
    }

    return AdminService.serialiserOffre(offre);
  }

  async deleteOffre(id: number) {
    await this.prisma.offre.delete({ where: { id } });
    return { message: 'Offre supprimée avec succès' };
  }

  async toggleOffreCloturee(id: number, estCloturee: boolean) {
    const offre = await this.prisma.offre.update({
      where: { id },
      data: { estCloturee },
    });
    return offre;
  }

  // ==================== USER DASHBOARD STATS ====================

  async getUserDashboardStats(userId: number) {
    // Le tableau de bord d'un membre ne compte que les offres qu'il peut
    // réellement ouvrir : un dépôt de partenaire en attente de relecture
    // gonflerait le total sans que rien de nouveau ne soit consultable.
    const publiees = { statutModeration: 'PUBLIEE' as const };

    const [totalOffres, totalFavorites, totalRetours, offresByType] =
      await Promise.all([
        this.prisma.offre.count({ where: publiees }),
        this.prisma.favorite.count({ where: { userId } }),
        this.prisma.retour.count({ where: { auteurId: userId } }),
        this.prisma.offre.groupBy({
          by: ['typeOffreId'],
          where: publiees,
          _count: { typeOffreId: true },
        }),
      ]);

    return {
      totalOffres,
      totalFavorites,
      totalRetours,
      offresByType: await this.indexerParCodeDeType(offresByType),
    };
  }

  /**
   * Convertit un regroupement par `typeOffreId` en objet indexé par code.
   *
   * Les statistiques restent ainsi lisibles côté client (`{ EMPLOI: 103, … }`)
   * alors que les types ne sont plus une énumération figée mais des lignes en
   * base, susceptibles d'être créées ou renommées.
   */
  private async indexerParCodeDeType(
    groupes: { typeOffreId: number; _count: { typeOffreId: number } }[],
  ): Promise<Record<string, number>> {
    const types = await this.prisma.typeOffre.findMany({
      select: { id: true, code: true },
    });
    const codeParId = new Map(types.map((t) => [t.id, t.code]));

    return groupes.reduce<Record<string, number>>((acc, groupe) => {
      const code = codeParId.get(groupe.typeOffreId);
      if (code) acc[code] = groupe._count.typeOffreId;
      return acc;
    }, {});
  }

  // ==================== STATISTICS ====================

  async getStatistics() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalUsers,
      totalOffres,
      totalRetours,
      offresByType,
      offresBySecteur,
      topOffres,
      newUsersThisMonth,
      newOffresThisMonth,
      newRetoursThisMonth,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.offre.count(),
      this.prisma.retour.count(),
      this.prisma.offre.groupBy({
        by: ['typeOffreId'],
        _count: { typeOffreId: true },
      }),
      this.prisma.offre.groupBy({
        by: ['secteur'],
        _count: { secteur: true },
        orderBy: { _count: { secteur: 'desc' } },
        take: 10,
      }),
      this.prisma.offre.findMany({
        take: 5,
        orderBy: { retours: { _count: 'desc' } },
        include: {
          auteur: { select: { id: true, username: true } },
          _count: { select: { retours: true } },
        },
      }),
      this.prisma.user.count({
        where: { createdAt: { gte: startOfMonth } },
      }),
      this.prisma.offre.count({
        where: { datePublication: { gte: startOfMonth } },
      }),
      this.prisma.retour.count({
        where: { datePublication: { gte: startOfMonth } },
      }),
    ]);

    return {
      totals: {
        users: totalUsers,
        offres: totalOffres,
        retours: totalRetours,
      },
      offresByType: await this.indexerParCodeDeType(offresByType),
      offresBySecteur: offresBySecteur.map((item) => ({
        secteur: item.secteur,
        count: item._count.secteur,
      })),
      topOffres: topOffres.map((offre) => ({
        id: offre.id,
        titre: offre.titre,
        auteur: offre.auteur.username,
        retoursCount: offre._count.retours,
      })),
      thisMonth: {
        newUsers: newUsersThisMonth,
        newOffres: newOffresThisMonth,
        newRetours: newRetoursThisMonth,
      },
    };
  }

  async getUsersDisaggregation() {
    const now = new Date();
    
    // Gender distribution
    const [hommes, femmes, autresSexe, nonPreciseSexe] = await Promise.all([
      this.prisma.user.count({ where: { sexe: 'HOMME' } }),
      this.prisma.user.count({ where: { sexe: 'FEMME' } }),
      this.prisma.user.count({ where: { sexe: 'AUTRE' } }),
      this.prisma.user.count({ where: { sexe: 'NON_PRECISE' } }),
    ]);

    // Disability status
    const [avecHandicap, sansHandicap] = await Promise.all([
      this.prisma.user.count({ where: { handicap: true } }),
      this.prisma.user.count({ where: { handicap: false } }),
    ]);

    // Age ranges - calculate from dateNaissance
    const usersWithBirthdate = await this.prisma.user.findMany({
      where: { dateNaissance: { not: null } },
      select: { dateNaissance: true },
    });

    const ageRanges = {
      '0-17': 0,
      '18-25': 0,
      '26-35': 0,
      '36-45': 0,
      '46-55': 0,
      '56-65': 0,
      '65+': 0,
      'Non précisé': 0,
    };

    const totalUsers = await this.prisma.user.count();
    ageRanges['Non précisé'] = totalUsers - usersWithBirthdate.length;

    usersWithBirthdate.forEach((user) => {
      if (user.dateNaissance) {
        const birthDate = new Date(user.dateNaissance);
        const age = Math.floor((now.getTime() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        
        if (age < 18) ageRanges['0-17']++;
        else if (age <= 25) ageRanges['18-25']++;
        else if (age <= 35) ageRanges['26-35']++;
        else if (age <= 45) ageRanges['36-45']++;
        else if (age <= 55) ageRanges['46-55']++;
        else if (age <= 65) ageRanges['56-65']++;
        else ageRanges['65+']++;
      }
    });

    // Professional status distribution
    const statutProfessionnelStats = await this.prisma.user.groupBy({
      by: ['statutProfessionnel'],
      _count: { statutProfessionnel: true },
    });

    // Geographic distribution (by pays)
    const paysStats = await this.prisma.user.groupBy({
      by: ['pays'],
      _count: { pays: true },
      orderBy: { _count: { pays: 'desc' } },
      take: 10,
    });

    // Commune distribution
    const communeStats = await this.prisma.user.groupBy({
      by: ['commune'],
      _count: { commune: true },
      orderBy: { _count: { commune: 'desc' } },
      take: 15,
    });

    // Region distribution
    const regionStats = await this.prisma.user.groupBy({
      by: ['region'],
      _count: { region: true },
      orderBy: { _count: { region: 'desc' } },
      take: 15,
    });

    // Departement distribution
    const departementStats = await this.prisma.user.groupBy({
      by: ['departement'],
      _count: { departement: true },
      orderBy: { _count: { departement: 'desc' } },
      take: 15,
    });

    return {
      gender: {
        hommes,
        femmes,
        autres: autresSexe,
        nonPrecise: nonPreciseSexe,
        total: hommes + femmes + autresSexe + nonPreciseSexe,
      },
      handicap: {
        avec: avecHandicap,
        sans: sansHandicap,
        total: avecHandicap + sansHandicap,
      },
      ageRanges,
      statutProfessionnel: statutProfessionnelStats.reduce((acc, item) => {
        acc[item.statutProfessionnel] = item._count.statutProfessionnel;
        return acc;
      }, {} as Record<string, number>),
      geographic: paysStats.map((item) => ({
        pays: item.pays || 'Non précisé',
        count: item._count.pays,
      })),
      communes: communeStats.map((item) => ({
        commune: item.commune || 'Non précisé',
        count: item._count.commune,
      })),
      regions: regionStats.map((item) => ({
        region: item.region || 'Non précisé',
        count: item._count.region,
      })),
      departements: departementStats.map((item) => ({
        departement: item.departement || 'Non précisé',
        count: item._count.departement,
      })),
    };
  }

  // ==================== BULK MESSAGING ====================

  async sendBulkMessage(adminId: number, userIds: number[], content: string) {
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
      select: { id: true, username: true, firstName: true, lastName: true },
    });

    if (!admin) {
      throw new NotFoundException('Admin non trouvé');
    }

    const results = { sent: 0, failed: 0 };

    for (const userId of userIds) {
      if (userId === adminId) continue;

      try {
        // Ensure consistent ordering (smaller ID first)
        const [user1Id, user2Id] = adminId < userId
          ? [adminId, userId]
          : [userId, adminId];

        // Get or create conversation
        let conversation = await this.prisma.privateConversation.findUnique({
          where: { user1Id_user2Id: { user1Id, user2Id } },
        });

        if (!conversation) {
          conversation = await this.prisma.privateConversation.create({
            data: { user1Id, user2Id },
          });
        }

        // Send message
        await this.prisma.privateMessage.create({
          data: {
            content,
            conversationId: conversation.id,
            senderId: adminId,
          },
        });

        // Update conversation timestamp
        await this.prisma.privateConversation.update({
          where: { id: conversation.id },
          data: { updatedAt: new Date() },
        });

        // Send notification
        const senderName = admin.firstName ? `${admin.firstName} ${admin.lastName || ''}`.trim() : admin.username;
        await this.notificationsService.notifyNewMessage(userId, senderName, conversation.id);

        results.sent++;
      } catch (error) {
        results.failed++;
      }
    }

    return {
      message: `Message envoyé à ${results.sent} utilisateur(s)${results.failed > 0 ? `, ${results.failed} échec(s)` : ''}`,
      sent: results.sent,
      failed: results.failed,
    };
  }
}
