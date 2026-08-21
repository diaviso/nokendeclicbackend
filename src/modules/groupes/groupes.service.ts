import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationType,
  Prisma,
  RoleGroupe,
  StatutInvitation,
} from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CreerGroupeDto,
  InviterDto,
  MessageGroupeDto,
  ModifierGroupeDto,
} from './dto';

/** Ce qu'on affiche d'une personne dans un groupe. */
const PROFIL = {
  id: true,
  username: true,
  firstName: true,
  lastName: true,
  pictureUrl: true,
  role: true,
} as const;

@Injectable()
export class GroupesService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  /* ------------------------------------------------------------ contrôles */

  /**
   * Vérifie l'appartenance et renvoie le rôle.
   *
   * Toutes les opérations passent par ici : sans ce point de passage unique,
   * il suffirait d'oublier le contrôle sur une seule route pour ouvrir la
   * lecture d'un groupe privé à quiconque connaît son identifiant.
   */
  private async exigerMembre(groupeId: number, userId: number) {
    const membre = await this.prisma.membreGroupe.findUnique({
      where: { groupeId_userId: { groupeId, userId } },
    });

    if (!membre) {
      // Même réponse que pour un groupe inexistant : distinguer les deux
      // révélerait l'existence de groupes auxquels on n'appartient pas.
      throw new NotFoundException('Groupe non trouvé');
    }

    return membre;
  }

  private async exigerAdmin(groupeId: number, userId: number) {
    const membre = await this.exigerMembre(groupeId, userId);

    if (membre.role !== RoleGroupe.ADMIN) {
      throw new ForbiddenException(
        'Seuls les administrateurs du groupe peuvent effectuer cette action',
      );
    }

    return membre;
  }

  private nomAffiche(user: {
    firstName: string | null;
    lastName: string | null;
    username: string;
  }) {
    const complet = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
    return complet || user.username;
  }

  /* --------------------------------------------------------------- groupes */

  async creer(userId: number, dto: CreerGroupeDto) {
    const invites = [...new Set(dto.membres ?? [])].filter((id) => id !== userId);

    // Les comptes sont vérifiés avant création : un identifiant inventé ferait
    // sinon échouer l'écriture à mi-chemin.
    if (invites.length > 0) {
      const existants = await this.prisma.user.count({
        where: { id: { in: invites }, isActive: true },
      });
      if (existants !== invites.length) {
        throw new BadRequestException(
          "Certains comptes invités n'existent pas ou sont désactivés",
        );
      }
    }

    const groupe = await this.prisma.groupeDiscussion.create({
      data: {
        nom: dto.nom.trim(),
        description: dto.description?.trim() || null,
        imageUrl: dto.imageUrl || null,
        creeParId: userId,
        // Qui crée administre : il faut au moins une personne capable
        // d'inviter, sans quoi le groupe naît inutilisable.
        membres: { create: { userId, role: RoleGroupe.ADMIN } },
        invitations: invites.length
          ? {
              create: invites.map((id) => ({
                userId: id,
                inviteParId: userId,
              })),
            }
          : undefined,
      },
    });

    await this.prevenirDesInvitations(groupe.id, groupe.nom, userId, invites);

    return this.detail(groupe.id, userId);
  }

  /** Groupes dont l'appelant est membre, du plus actif au plus ancien. */
  async mesGroupes(userId: number) {
    const membres = await this.prisma.membreGroupe.findMany({
      where: { userId },
      include: {
        groupe: {
          include: {
            _count: { select: { membres: true } },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: { auteur: { select: PROFIL } },
            },
          },
        },
      },
    });

    const groupes = await Promise.all(
      membres.map(async (membre) => {
        const nonLus = await this.prisma.messageGroupe.count({
          where: {
            groupeId: membre.groupeId,
            auteurId: { not: userId },
            ...(membre.luJusquA ? { createdAt: { gt: membre.luJusquA } } : {}),
          },
        });

        return {
          id: membre.groupe.id,
          nom: membre.groupe.nom,
          description: membre.groupe.description,
          imageUrl: membre.groupe.imageUrl,
          role: membre.role,
          nombreMembres: membre.groupe._count.membres,
          dernierMessage: membre.groupe.messages[0] ?? null,
          nonLus,
          updatedAt: membre.groupe.updatedAt,
        };
      }),
    );

    return groupes.sort((a, b) => {
      const dateA = a.dernierMessage?.createdAt ?? a.updatedAt;
      const dateB = b.dernierMessage?.createdAt ?? b.updatedAt;
      return dateB.getTime() - dateA.getTime();
    });
  }

  async detail(groupeId: number, userId: number) {
    const membre = await this.exigerMembre(groupeId, userId);

    const groupe = await this.prisma.groupeDiscussion.findUnique({
      where: { id: groupeId },
      include: {
        membres: {
          include: { user: { select: PROFIL } },
          orderBy: [{ role: 'asc' }, { rejointLe: 'asc' }],
        },
        invitations: {
          where: { statut: StatutInvitation.EN_ATTENTE },
          include: { user: { select: PROFIL } },
        },
        creePar: { select: PROFIL },
      },
    });

    if (!groupe) throw new NotFoundException('Groupe non trouvé');

    return { ...groupe, monRole: membre.role };
  }

  async modifier(groupeId: number, userId: number, dto: ModifierGroupeDto) {
    await this.exigerAdmin(groupeId, userId);

    await this.prisma.groupeDiscussion.update({
      where: { id: groupeId },
      data: {
        ...(dto.nom !== undefined ? { nom: dto.nom.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description.trim() || null }
          : {}),
        ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl || null } : {}),
      },
    });

    return this.detail(groupeId, userId);
  }

  /** Dissout le groupe pour tout le monde. Réservé aux administrateurs. */
  async supprimer(groupeId: number, userId: number) {
    await this.exigerAdmin(groupeId, userId);

    const groupe = await this.prisma.groupeDiscussion.findUnique({
      where: { id: groupeId },
      include: { membres: { select: { userId: true } } },
    });

    if (!groupe) throw new NotFoundException('Groupe non trouvé');

    await this.prisma.groupeDiscussion.delete({ where: { id: groupeId } });

    // Prévenir : une discussion qui disparaît sans explication ressemble à une
    // panne.
    await Promise.all(
      groupe.membres
        .filter((m) => m.userId !== userId)
        .map((m) =>
          this.notifications.createNotification(
            m.userId,
            NotificationType.SYSTEM,
            'Groupe supprimé',
            `Le groupe « ${groupe.nom} » a été supprimé par un administrateur.`,
          ),
        ),
    );

    return { message: 'Groupe supprimé' };
  }

  /**
   * Personnes que l'appelant a le droit d'inviter.
   *
   * Le répertoire des membres n'est pas public sur la plateforme : seuls
   * l'administration et les partenaires peuvent parcourir les profils. On ne
   * l'ouvre pas par la porte des groupes. La règle reprend donc celle de la
   * messagerie, élargie aux personnes qu'on côtoie déjà dans un groupe — c'est
   * ce qui permet à un groupe de s'étendre sans exposer l'annuaire.
   */
  async invitables(userId: number, groupeId?: number) {
    const moi = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!moi) throw new NotFoundException('Utilisateur non trouvé');

    let critere: Prisma.UserWhereInput;

    if (moi.role === 'ADMIN') {
      critere = { id: { not: userId }, isActive: true };
    } else {
      // Personnes présentes dans au moins un groupe commun.
      const communs = await this.prisma.membreGroupe.findMany({
        where: { groupe: { membres: { some: { userId } } } },
        select: { userId: true },
      });
      const cotoyees = [...new Set(communs.map((m) => m.userId))].filter(
        (id) => id !== userId,
      );

      const parRole: Prisma.UserWhereInput[] =
        moi.role === 'PARTENAIRE'
          ? [{ role: 'ADMIN' }, { role: 'MEMBRE', cv: { estPublic: true } }]
          : [{ role: 'ADMIN' }];

      critere = {
        id: { not: userId },
        isActive: true,
        OR: [...parRole, ...(cotoyees.length ? [{ id: { in: cotoyees } }] : [])],
      };
    }

    // Celles qui sont déjà dans le groupe ou déjà sollicitées n'ont rien à
    // faire dans la liste : les proposer ferait espérer une action sans effet.
    if (groupeId) {
      await this.exigerMembre(groupeId, userId);
      const [membres, invitations] = await Promise.all([
        this.prisma.membreGroupe.findMany({
          where: { groupeId },
          select: { userId: true },
        }),
        this.prisma.invitationGroupe.findMany({
          where: { groupeId, statut: StatutInvitation.EN_ATTENTE },
          select: { userId: true },
        }),
      ]);
      const exclus = [
        ...membres.map((m) => m.userId),
        ...invitations.map((i) => i.userId),
      ];
      if (exclus.length) {
        critere = { AND: [critere, { id: { notIn: exclus } }] };
      }
    }

    return this.prisma.user.findMany({
      where: critere,
      select: PROFIL,
      orderBy: [{ role: 'asc' }, { firstName: 'asc' }, { username: 'asc' }],
      take: 200,
    });
  }

  /* ----------------------------------------------------------- invitations */

  private async prevenirDesInvitations(
    groupeId: number,
    nomGroupe: string,
    invitantId: number,
    userIds: number[],
  ) {
    if (userIds.length === 0) return;

    const invitant = await this.prisma.user.findUnique({
      where: { id: invitantId },
      select: PROFIL,
    });
    const nom = invitant ? this.nomAffiche(invitant) : 'Un membre';

    await Promise.all(
      userIds.map((id) =>
        this.notifications.createNotification(
          id,
          NotificationType.SYSTEM,
          'Invitation à un groupe',
          `${nom} vous invite à rejoindre « ${nomGroupe} ».`,
          '/messagerie',
        ),
      ),
    );
  }

  async inviter(groupeId: number, userId: number, dto: InviterDto) {
    await this.exigerAdmin(groupeId, userId);

    const groupe = await this.prisma.groupeDiscussion.findUnique({
      where: { id: groupeId },
      select: { nom: true },
    });
    if (!groupe) throw new NotFoundException('Groupe non trouvé');

    const demandes = [...new Set(dto.userIds)].filter((id) => id !== userId);
    if (demandes.length === 0) {
      throw new BadRequestException('Aucun compte à inviter');
    }

    const [comptes, dejaMembres, invitations] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: demandes }, isActive: true },
        select: { id: true },
      }),
      this.prisma.membreGroupe.findMany({
        where: { groupeId, userId: { in: demandes } },
        select: { userId: true },
      }),
      this.prisma.invitationGroupe.findMany({
        where: { groupeId, userId: { in: demandes } },
      }),
    ]);

    const valides = new Set(comptes.map((c) => c.id));
    const membres = new Set(dejaMembres.map((m) => m.userId));
    const connues = new Map(invitations.map((i) => [i.userId, i]));

    const aInviter = demandes.filter((id) => valides.has(id) && !membres.has(id));
    const nouvelles = aInviter.filter((id) => !connues.has(id));
    // Une invitation refusée peut être renouvelée : un « non » d'il y a six
    // mois ne ferme pas la porte définitivement. En attente, en revanche, on
    // ne renvoie rien — ce serait du harcèlement.
    const aRelancer = aInviter.filter(
      (id) => connues.get(id)?.statut === StatutInvitation.REFUSEE,
    );

    await this.prisma.$transaction([
      ...(nouvelles.length
        ? [
            this.prisma.invitationGroupe.createMany({
              data: nouvelles.map((id) => ({
                groupeId,
                userId: id,
                inviteParId: userId,
              })),
            }),
          ]
        : []),
      ...(aRelancer.length
        ? [
            this.prisma.invitationGroupe.updateMany({
              where: { groupeId, userId: { in: aRelancer } },
              data: {
                statut: StatutInvitation.EN_ATTENTE,
                inviteParId: userId,
                repondueLe: null,
              },
            }),
          ]
        : []),
    ]);

    const envoyees = [...nouvelles, ...aRelancer];
    await this.prevenirDesInvitations(groupeId, groupe.nom, userId, envoyees);

    return {
      invites: envoyees.length,
      ignores: demandes.length - envoyees.length,
      message:
        envoyees.length > 0
          ? `${envoyees.length} invitation(s) envoyée(s)`
          : 'Aucune nouvelle invitation à envoyer',
    };
  }

  /** Invitations en attente adressées à l'appelant. */
  async mesInvitations(userId: number) {
    return this.prisma.invitationGroupe.findMany({
      where: { userId, statut: StatutInvitation.EN_ATTENTE },
      include: {
        groupe: {
          select: {
            id: true,
            nom: true,
            description: true,
            imageUrl: true,
            _count: { select: { membres: true } },
          },
        },
        invitePar: { select: PROFIL },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async repondre(invitationId: number, userId: number, accepte: boolean) {
    const invitation = await this.prisma.invitationGroupe.findUnique({
      where: { id: invitationId },
      include: { groupe: { select: { id: true, nom: true } } },
    });

    if (!invitation || invitation.userId !== userId) {
      throw new NotFoundException('Invitation non trouvée');
    }

    if (invitation.statut !== StatutInvitation.EN_ATTENTE) {
      throw new BadRequestException('Cette invitation a déjà reçu une réponse');
    }

    await this.prisma.$transaction([
      this.prisma.invitationGroupe.update({
        where: { id: invitationId },
        data: {
          statut: accepte ? StatutInvitation.ACCEPTEE : StatutInvitation.REFUSEE,
          repondueLe: new Date(),
        },
      }),
      ...(accepte
        ? [
            this.prisma.membreGroupe.create({
              data: { groupeId: invitation.groupeId, userId },
            }),
          ]
        : []),
    ]);

    return {
      message: accepte
        ? `Vous avez rejoint « ${invitation.groupe.nom} »`
        : 'Invitation refusée',
      groupeId: accepte ? invitation.groupeId : null,
    };
  }

  /* --------------------------------------------------------------- membres */

  /** `cibleId` désigne le compte visé, non la ligne d'appartenance. */
  async changerRole(
    groupeId: number,
    userId: number,
    cibleId: number,
    role: RoleGroupe,
  ) {
    await this.exigerAdmin(groupeId, userId);

    const cible = await this.prisma.membreGroupe.findUnique({
      where: { groupeId_userId: { groupeId, userId: cibleId } },
    });
    if (!cible) {
      throw new NotFoundException('Ce compte ne fait pas partie du groupe');
    }

    if (cible.role === role) return { message: 'Rôle inchangé' };

    // Un groupe sans administrateur ne peut plus être ni modéré ni dissous :
    // il faut en garder au moins un.
    if (role === RoleGroupe.MEMBRE) {
      const admins = await this.prisma.membreGroupe.count({
        where: { groupeId, role: RoleGroupe.ADMIN },
      });
      if (admins <= 1) {
        throw new BadRequestException(
          'Le groupe doit conserver au moins un administrateur',
        );
      }
    }

    await this.prisma.membreGroupe.update({
      where: { groupeId_userId: { groupeId, userId: cibleId } },
      data: { role },
    });

    return { message: 'Rôle mis à jour' };
  }

  /** `cibleId` désigne le compte visé, non la ligne d'appartenance. */
  async retirerMembre(groupeId: number, userId: number, cibleId: number) {
    await this.exigerAdmin(groupeId, userId);

    if (cibleId === userId) {
      throw new BadRequestException(
        'Utilisez « quitter le groupe » pour vous retirer vous-même',
      );
    }

    const cible = await this.prisma.membreGroupe.findUnique({
      where: { groupeId_userId: { groupeId, userId: cibleId } },
      include: { groupe: { select: { nom: true } } },
    });
    if (!cible) {
      throw new NotFoundException('Ce compte ne fait pas partie du groupe');
    }

    await this.prisma.$transaction([
      this.prisma.membreGroupe.delete({
        where: { groupeId_userId: { groupeId, userId: cibleId } },
      }),
      // L'invitation part avec : sans cela, la contrainte d'unicité
      // empêcherait de réinviter la personne plus tard.
      this.prisma.invitationGroupe.deleteMany({
        where: { groupeId, userId: cibleId },
      }),
    ]);

    await this.notifications.createNotification(
      cibleId,
      NotificationType.SYSTEM,
      'Retiré du groupe',
      `Vous ne faites plus partie du groupe « ${cible.groupe.nom} ».`,
    );

    return { message: 'Membre retiré du groupe' };
  }

  async quitter(groupeId: number, userId: number) {
    const membre = await this.exigerMembre(groupeId, userId);

    const [admins, total] = await Promise.all([
      this.prisma.membreGroupe.count({
        where: { groupeId, role: RoleGroupe.ADMIN },
      }),
      this.prisma.membreGroupe.count({ where: { groupeId } }),
    ]);

    // Dernière personne présente : le groupe n'a plus de raison d'exister.
    if (total === 1) {
      await this.prisma.groupeDiscussion.delete({ where: { id: groupeId } });
      return { message: 'Vous avez quitté le groupe, qui a été supprimé' };
    }

    if (membre.role === RoleGroupe.ADMIN && admins === 1) {
      throw new BadRequestException(
        'Nommez un autre administrateur avant de quitter le groupe',
      );
    }

    await this.prisma.$transaction([
      this.prisma.membreGroupe.delete({
        where: { groupeId_userId: { groupeId, userId } },
      }),
      this.prisma.invitationGroupe.deleteMany({ where: { groupeId, userId } }),
    ]);

    return { message: 'Vous avez quitté le groupe' };
  }

  /* -------------------------------------------------------------- messages */

  async messages(groupeId: number, userId: number, page = 1, limit = 50) {
    await this.exigerMembre(groupeId, userId);

    const messages = await this.prisma.messageGroupe.findMany({
      where: { groupeId },
      include: { auteur: { select: PROFIL } },
      // L'identifiant départage les messages écrits dans la même milliseconde :
      // sans lui, leur ordre relatif est indéterminé.
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    });

    await this.prisma.membreGroupe.update({
      where: { groupeId_userId: { groupeId, userId } },
      data: { luJusquA: new Date() },
    });

    return messages.reverse();
  }

  async envoyer(groupeId: number, userId: number, dto: MessageGroupeDto) {
    await this.exigerMembre(groupeId, userId);

    const message = await this.prisma.messageGroupe.create({
      data: { groupeId, auteurId: userId, contenu: dto.contenu.trim() },
      include: { auteur: { select: PROFIL } },
    });

    const groupe = await this.prisma.groupeDiscussion.update({
      where: { id: groupeId },
      data: { updatedAt: new Date() },
      select: {
        nom: true,
        membres: { where: { userId: { not: userId } }, select: { userId: true } },
      },
    });

    const nom = message.auteur ? this.nomAffiche(message.auteur) : 'Un membre';
    const extrait =
      dto.contenu.length > 80 ? `${dto.contenu.slice(0, 80)}…` : dto.contenu;

    await Promise.all(
      groupe.membres.map((m) =>
        this.notifications.createNotification(
          m.userId,
          NotificationType.NEW_MESSAGE,
          groupe.nom,
          `${nom} : ${extrait}`,
          `/messagerie?groupe=${groupeId}`,
        ),
      ),
    );

    return message;
  }

  /**
   * Supprime un message : son auteur, ou un administrateur du groupe.
   *
   * Les administrateurs doivent pouvoir retirer ce qui n'a pas sa place dans
   * le groupe ; sans cela, la modération n'existe pas.
   */
  async supprimerMessage(groupeId: number, userId: number, messageId: number) {
    const membre = await this.exigerMembre(groupeId, userId);

    const message = await this.prisma.messageGroupe.findUnique({
      where: { id: messageId },
    });

    if (!message || message.groupeId !== groupeId) {
      throw new NotFoundException('Message non trouvé');
    }

    if (message.auteurId !== userId && membre.role !== RoleGroupe.ADMIN) {
      throw new ForbiddenException(
        'Vous ne pouvez supprimer que vos propres messages',
      );
    }

    await this.prisma.messageGroupe.delete({ where: { id: messageId } });

    return { message: 'Message supprimé' };
  }
}
