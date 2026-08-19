import { IsObject, IsString, IsUrl, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** Abonnement tel que le navigateur le produit. */
export class AbonnementPushDto {
  @ApiProperty({ example: 'https://fcm.googleapis.com/fcm/send/…' })
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  @MaxLength(600)
  endpoint: string;

  @ApiProperty({ example: { p256dh: '…', auth: '…' } })
  @IsObject()
  keys: { p256dh: string; auth: string };
}

export class DesabonnementPushDto {
  @ApiProperty()
  @IsString()
  @MaxLength(600)
  endpoint: string;
}
