import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { StatutProfessionnel } from '../../../generated/prisma';

/** Critères de recherche d'un profil, tous facultatifs. */
export class RechercheProfilsDto {
  @ApiPropertyOptional({
    description: 'Recherche libre : métier, compétence, établissement…',
    example: 'développeur react',
  })
  @IsString()
  @MaxLength(120)
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Compétences exigées. Leur absence pénalise le classement.',
  })
  @IsArray()
  @ArrayMaxSize(15)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  @IsOptional()
  // Transmises en répétant le paramètre ou en une chaîne séparée par des
  // virgules : les deux formes circulent dans les liens partagés.
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value
      : typeof value === 'string'
        ? value.split(',').map((v) => v.trim()).filter(Boolean)
        : undefined,
  )
  competences?: string[];

  @ApiPropertyOptional({ example: 'Anglais' })
  @IsString()
  @MaxLength(40)
  @IsOptional()
  langue?: string;

  @ApiPropertyOptional({ example: 'Ziguinchor' })
  @IsString()
  @MaxLength(80)
  @IsOptional()
  localisation?: string;

  @ApiPropertyOptional({ enum: StatutProfessionnel })
  @IsEnum(StatutProfessionnel)
  @IsOptional()
  statutProfessionnel?: StatutProfessionnel;

  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number;
}
