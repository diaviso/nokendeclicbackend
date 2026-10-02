import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const FILTRES_MEDIAS = [
  'toutes',
  'miennes',
  'inutilisees',
  'communes',
] as const;
export type FiltreMedias = (typeof FILTRES_MEDIAS)[number];

export const TRIS_MEDIAS = ['recentes', 'utilisees'] as const;
export type TriMedias = (typeof TRIS_MEDIAS)[number];

/** Texte facultatif : vide équivaut à absent. */
const nettoyer = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

export class ListeMediasDto {
  @ApiPropertyOptional({
    description:
      'Recherche dans le nom, le texte alternatif et les offres qui utilisent l’image',
  })
  @Transform(nettoyer)
  @IsString()
  @MaxLength(100)
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({ enum: FILTRES_MEDIAS, default: 'toutes' })
  @IsIn(FILTRES_MEDIAS)
  @IsOptional()
  filtre?: FiltreMedias;

  @ApiPropertyOptional({ enum: TRIS_MEDIAS, default: 'recentes' })
  @IsIn(TRIS_MEDIAS)
  @IsOptional()
  tri?: TriMedias;

  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 24, maximum: 60 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  @IsOptional()
  limite?: number;
}

/** Champs accompagnant l'envoi d'une image (formulaire multipart). */
export class DeposerMediaDto {
  @ApiPropertyOptional({ description: 'Libellé ; à défaut, le nom du fichier' })
  @Transform(nettoyer)
  @IsString()
  @MaxLength(120)
  @IsOptional()
  nom?: string;

  @ApiPropertyOptional({ description: 'Texte alternatif proposé par défaut' })
  @Transform(nettoyer)
  @IsString()
  @MaxLength(300)
  @IsOptional()
  alt?: string;
}

export class ModifierMediaDto {
  @ApiPropertyOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(120)
  @IsOptional()
  nom?: string;

  @ApiPropertyOptional({ description: 'Chaîne vide pour effacer' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(300)
  @IsOptional()
  alt?: string;

  @ApiPropertyOptional({ description: 'Réservé à l’administration' })
  @IsBoolean()
  @IsOptional()
  commune?: boolean;
}

export class CouvertureDto {
  @ApiProperty({ description: 'Image de la médiathèque à utiliser' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  mediaId!: number;
}
