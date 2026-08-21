import { IsObject, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Abonnement tel que le navigateur le produit.
 *
 * Le corps de la requête est la sortie littérale de
 * `PushSubscription.toJSON()` : sa forme est décidée par le navigateur, pas
 * par nous. Chrome y sérialise `expirationTime: null`, WebKit l'omet — d'où un
 * champ facultatif ici, et une validation qui ne refuse pas les propriétés
 * inconnues côté contrôleur. Refuser ce que le navigateur envoie revient à
 * refuser la plateforme entière.
 */
export class AbonnementPushDto {
  @ApiProperty({ example: 'https://fcm.googleapis.com/fcm/send/…' })
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  @MaxLength(600)
  endpoint: string;

  @ApiProperty({ example: { p256dh: '…', auth: '…' } })
  @IsObject()
  keys: { p256dh: string; auth: string };

  /** Toujours nul en pratique : aucun service de poussée ne date ses abonnements. */
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  expirationTime?: number | null;
}

export class DesabonnementPushDto {
  @ApiProperty()
  @IsString()
  @MaxLength(600)
  endpoint: string;
}
