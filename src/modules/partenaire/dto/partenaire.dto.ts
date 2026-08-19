import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Secteur } from '../../../generated/prisma';

/** Fiche de la structure partenaire, telle qu'elle la renseigne elle-même. */
export class EntreprisePartenaireDto {
  @ApiProperty({ example: 'Sarl Baobab' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nom: string;

  @ApiPropertyOptional({ example: 'Agence de communication basée à Ziguinchor.' })
  @IsString()
  @MaxLength(1500)
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: Secteur })
  @IsEnum(Secteur)
  @IsOptional()
  secteur?: Secteur;

  /**
   * `require_tld` reste actif : une adresse sans domaine de premier niveau
   * n'est pas atteignable depuis un lien public.
   */
  @ApiPropertyOptional({ example: 'https://baobab.sn' })
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(300)
  @IsOptional()
  siteWeb?: string;

  @ApiPropertyOptional({ example: 'contact@baobab.sn' })
  @IsEmail()
  @MaxLength(200)
  @IsOptional()
  emailContact?: string;

  @ApiPropertyOptional({ example: '+221 77 000 00 00' })
  @IsString()
  @MaxLength(40)
  @IsOptional()
  telephone?: string;

  @ApiPropertyOptional({ example: 'Ziguinchor' })
  @IsString()
  @MaxLength(120)
  @IsOptional()
  ville?: string;

  @ApiPropertyOptional({ example: 'Ziguinchor' })
  @IsString()
  @MaxLength(120)
  @IsOptional()
  region?: string;

  @ApiPropertyOptional({ example: '10 à 49 salariés' })
  @IsString()
  @MaxLength(60)
  @IsOptional()
  taille?: string;
}

/** Annotation privée d'un partenaire sur un candidat mis de côté. */
export class NoteFavoriDto {
  @ApiPropertyOptional({ example: 'Profil intéressant pour le poste de mars.' })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  note?: string;
}

/** Réglages de vitrine, réservés à l'administration. */
export class VitrineDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  @IsOptional()
  estVisibleVitrine?: boolean;

  @ApiPropertyOptional({ example: 0 })
  @IsInt()
  @IsOptional()
  ordreVitrine?: number;
}
