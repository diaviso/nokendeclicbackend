import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PrismaService } from '../../prisma/prisma.service';

/** Charge utile lue par le service worker. */
export interface ChargePush {
  titre: string;
  corps: string;
  /** Adresse ouverte au clic sur la notification. */
  lien?: string;
  /** Regroupe les notifications de même nature : la dernière remplace la précédente. */
  groupe?: string;
}

/**
 * Notifications poussées vers les navigateurs abonnés.
 *
 * Le service ne s'active que si une paire de clés VAPID est configurée. Sans
 * elle, les abonnements sont refusés et les envois ignorés en silence : une
 * plateforme déployée sans ces clés doit continuer de fonctionner, seule la
 * poussée manque.
 */
@Injectable()
export class PushService implements OnModuleInit {
  private readonly journal = new Logger(PushService.name);
  private actif = false;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  onModuleInit() {
    const publique = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privee = this.config.get<string>('VAPID_PRIVATE_KEY');
    const sujet =
      this.config.get<string>('VAPID_SUBJECT') ?? 'mailto:contact@nokendeclic.com';

    if (!publique || !privee) {
      this.journal.warn(
        'Clés VAPID absentes — les notifications poussées sont désactivées.',
      );
      return;
    }

    webpush.setVapidDetails(sujet, publique, privee);
    this.actif = true;
    this.journal.log('Notifications poussées actives.');
  }

  get estActif() {
    return this.actif;
  }

  /** Clé publique, à transmettre au navigateur pour qu'il s'abonne. */
  clePublique(): string | null {
    return this.config.get<string>('VAPID_PUBLIC_KEY') ?? null;
  }

  /**
   * Enregistre un navigateur.
   *
   * `upsert` sur l'adresse : un même navigateur qui se réabonne — après une
   * réinstallation du service worker, par exemple — ne doit pas créer un
   * doublon qui ferait arriver chaque notification deux fois.
   */
  async enregistrer(
    userId: number,
    abonnement: { endpoint: string; keys: { p256dh: string; auth: string } },
    userAgent?: string,
  ) {
    const donnees = {
      userId,
      endpoint: abonnement.endpoint,
      p256dh: abonnement.keys.p256dh,
      auth: abonnement.keys.auth,
      userAgent: userAgent?.slice(0, 300),
    };

    await this.prisma.pushSubscription.upsert({
      where: { endpoint: abonnement.endpoint },
      update: donnees,
      create: donnees,
    });

    return { message: 'Notifications activées sur cet appareil' };
  }

  async retirer(endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint } });
    return { message: 'Notifications désactivées sur cet appareil' };
  }

  /** Appareils enregistrés pour ce compte. */
  async mesAppareils(userId: number) {
    return this.prisma.pushSubscription.findMany({
      where: { userId },
      select: {
        id: true,
        endpoint: true,
        userAgent: true,
        createdAt: true,
        derniereReussite: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Pousse une notification vers tous les appareils d'une personne.
   *
   * Les envois sont lancés ensemble et jamais propagés : une notification est
   * un supplément, son échec ne doit pas faire échouer l'action qui l'a
   * déclenchée — publier une offre ne peut pas rater parce qu'un téléphone est
   * hors service.
   *
   * Un abonnement révoqué (404 ou 410) est supprimé : le navigateur a désinstallé
   * l'application ou vidé ses données, et le conserver ferait échouer chaque
   * envoi suivant.
   */
  async envoyerA(userId: number, charge: ChargePush): Promise<number> {
    if (!this.actif) return 0;

    const abonnements = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });
    if (abonnements.length === 0) return 0;

    const corps = JSON.stringify(charge);
    let reussis = 0;

    await Promise.all(
      abonnements.map(async (abonnement) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: abonnement.endpoint,
              keys: { p256dh: abonnement.p256dh, auth: abonnement.auth },
            },
            corps,
            { TTL: 60 * 60 * 24 },
          );
          reussis += 1;
          await this.prisma.pushSubscription.update({
            where: { id: abonnement.id },
            data: { derniereReussite: new Date() },
          });
        } catch (erreur) {
          const code = (erreur as { statusCode?: number })?.statusCode;
          if (code === 404 || code === 410) {
            await this.prisma.pushSubscription.delete({
              where: { id: abonnement.id },
            });
            return;
          }
          this.journal.warn(
            `Envoi poussé refusé (${code ?? 'sans code'}) pour l'abonnement ${abonnement.id}`,
          );
        }
      }),
    );

    return reussis;
  }

  /** Pousse vers plusieurs personnes, sans jamais propager d'échec. */
  async envoyerAPlusieurs(userIds: number[], charge: ChargePush) {
    await Promise.all(userIds.map((id) => this.envoyerA(id, charge)));
  }
}
