import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoleGroupe } from '../../../generated/prisma';

export class CreerGroupeDto {
  @ApiProperty({ example: 'Promotion 2026' })
  @IsString()
  @MinLength(2, { message: 'Le nom doit faire au moins 2 caractères' })
  @MaxLength(80, { message: 'Le nom ne peut pas dépasser 80 caractères' })
  nom: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({}, { message: "L'image doit être une URL valide" })
  imageUrl?: string;

  /** Personnes invitées dès la création : le groupe vide sert rarement. */
  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsInt({ each: true })
  membres?: number[];
}

export class ModifierGroupeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  nom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;
}

export class InviterDto {
  @ApiProperty({ type: [Number] })
  @IsInt({ each: true })
  userIds: number[];
}

export class MessageGroupeDto {
  @ApiProperty()
  @IsString()
  @MinLength(1, { message: 'Le message ne peut pas être vide' })
  @MaxLength(5000, { message: 'Le message ne peut pas dépasser 5000 caractères' })
  contenu: string;
}

export class RoleMembreDto {
  @ApiProperty({ enum: RoleGroupe })
  @IsEnum(RoleGroupe)
  role: RoleGroupe;
}
