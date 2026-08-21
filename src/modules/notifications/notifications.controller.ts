import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Delete,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';
import { AbonnementPushDto, DesabonnementPushDto } from './dto/push.dto';
import { CurrentUser, Public } from '../../common';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('api/notifications')
export class NotificationsController {
  constructor(
    private notificationsService: NotificationsService,
    private push: PushService,
  ) {}

  /* ------------------------------------------------- Notifications poussées */

  @Public()
  @Get('push/cle-publique')
  @ApiOperation({ summary: "Clé publique VAPID, nécessaire pour s'abonner" })
  clePublique() {
    // Publique par nature : c'est elle que le navigateur intègre à sa demande
    // d'abonnement. La clé privée ne quitte jamais le serveur.
    return { cle: this.push.clePublique(), actif: this.push.estActif };
  }

  @Post('push/abonnement')
  @ApiOperation({ summary: 'Abonner cet appareil aux notifications poussées' })
  // Le corps reçu est la sortie de `PushSubscription.toJSON()`, dont la forme
  // appartient au navigateur : Chrome y ajoute `expirationTime`, WebKit non.
  // La validation globale refusant les propriétés non déclarées, ce seul champ
  // a fait échouer en 400 la totalité des abonnements Android pendant que ceux
  // d'iOS passaient. Le DTO le déclare donc, et le client n'envoie plus que
  // les deux champs utiles — de sorte qu'un champ ajouté demain par un
  // navigateur n'atteigne même pas cette route.
  abonner(
    @CurrentUser('id') userId: number,
    @Body() dto: AbonnementPushDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.push.enregistrer(
      userId,
      { endpoint: dto.endpoint, keys: dto.keys },
      userAgent,
    );
  }

  @Delete('push/abonnement')
  @ApiOperation({ summary: 'Désabonner cet appareil' })
  desabonner(@Body() dto: DesabonnementPushDto) {
    return this.push.retirer(dto.endpoint);
  }

  @Get('push/appareils')
  @ApiOperation({ summary: 'Appareils abonnés pour ce compte' })
  mesAppareils(@CurrentUser('id') userId: number) {
    return this.push.mesAppareils(userId);
  }

  @Post('push/essai')
  @ApiOperation({ summary: "Envoyer une notification d'essai à ses appareils" })
  async essai(@CurrentUser('id') userId: number) {
    const envoyees = await this.push.envoyerA(userId, {
      titre: 'Noken',
      corps: 'Les notifications fonctionnent sur cet appareil.',
      lien: '/dashboard',
      groupe: 'essai',
    });
    return { envoyees };
  }

  @Get()
  @ApiOperation({ summary: 'Get user notifications' })
  async getNotifications(@CurrentUser('id') userId: number) {
    return this.notificationsService.getUserNotifications(userId);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notifications count' })
  async getUnreadCount(@CurrentUser('id') userId: number) {
    const count = await this.notificationsService.getUnreadCount(userId);
    return { unreadCount: count };
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  async markAsRead(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) notificationId: number,
  ) {
    await this.notificationsService.markAsRead(userId, notificationId);
    return { success: true };
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@CurrentUser('id') userId: number) {
    await this.notificationsService.markAllAsRead(userId);
    return { success: true };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  async deleteNotification(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) notificationId: number,
  ) {
    await this.notificationsService.deleteNotification(userId, notificationId);
    return { success: true };
  }
}
