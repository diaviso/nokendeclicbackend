import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsArray,
  IsBoolean,
  IsDateString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export enum TypeOffre {
  EMPLOI = 'EMPLOI',
  FORMATION = 'FORMATION',
  BOURSE = 'BOURSE',
  VOLONTARIAT = 'VOLONTARIAT',
}

export enum TypeEmploi {
  CDI = 'CDI',
  CDD = 'CDD',
  STAGE = 'STAGE',
  ALTERNANCE = 'ALTERNANCE',
  FREELANCE = 'FREELANCE',
  INTERIM = 'INTERIM',
  SAISONNIER = 'SAISONNIER',
  TEMPS_PARTIEL = 'TEMPS_PARTIEL',
  TEMPS_PLEIN = 'TEMPS_PLEIN',
}

export enum Secteur {
  INFORMATIQUE = 'INFORMATIQUE',
  FINANCE = 'FINANCE',
  SANTE = 'SANTE',
  EDUCATION = 'EDUCATION',
  COMMERCE = 'COMMERCE',
  INDUSTRIE = 'INDUSTRIE',
  AGRICULTURE = 'AGRICULTURE',
  TOURISME = 'TOURISME',
  TRANSPORT = 'TRANSPORT',
  COMMUNICATION = 'COMMUNICATION',
  ADMINISTRATION = 'ADMINISTRATION',
  ARTISANAT = 'ARTISANAT',
  CONSTRUCTION = 'CONSTRUCTION',
  ENERGIE = 'ENERGIE',
  ENVIRONNEMENT = 'ENVIRONNEMENT',
  JURIDIQUE = 'JURIDIQUE',
  MARKETING = 'MARKETING',
  RESSOURCES_HUMAINES = 'RESSOURCES_HUMAINES',
  RECHERCHE = 'RECHERCHE',
  AUTRE = 'AUTRE',
}

export enum NiveauExperience {
  DEBUTANT = 'DEBUTANT',
  JUNIOR = 'JUNIOR',
  CONFIRME = 'CONFIRME',
  SENIOR = 'SENIOR',
  EXPERT = 'EXPERT',
}

export class CreateOffreDto {
  @ApiProperty({ example: 'Développeur Full Stack' })
  @IsString()
  @MaxLength(200)
  titre: string;

  @ApiProperty({ example: 'Description du poste...' })
  @IsString()
  @MaxLength(5000)
  description: string;

  @ApiPropertyOptional({ example: 'https://example.com/offre' })
  @IsString()
  @IsOptional()
  url?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dateLimite?: string;

  @ApiProperty({ enum: TypeOffre })
  @IsEnum(TypeOffre)
  typeOffre: TypeOffre;

  @ApiPropertyOptional({ enum: TypeEmploi })
  @IsEnum(TypeEmploi)
  @IsOptional()
  typeEmploi?: TypeEmploi;

  @ApiPropertyOptional({ enum: Secteur })
  @IsEnum(Secteur)
  @IsOptional()
  secteur?: Secteur;

  @ApiPropertyOptional({ enum: NiveauExperience })
  @IsEnum(NiveauExperience)
  @IsOptional()
  niveauExperience?: NiveauExperience;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ example: 'Dakar' })
  @IsString()
  @IsOptional()
  localisation?: string;

  @ApiPropertyOptional({ example: 'Entreprise XYZ' })
  @IsString()
  @IsOptional()
  entreprise?: string;

  @ApiPropertyOptional({ example: 500000 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Transform(({ value }) => value ? Number(value) : undefined)
  salaireMin?: number;

  @ApiPropertyOptional({ example: 800000 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Transform(({ value }) => value ? Number(value) : undefined)
  salaireMax?: number;

  @ApiPropertyOptional({ example: 'FCFA' })
  @IsString()
  @IsOptional()
  devise?: string;

  // Formation
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  organisme?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => value ? Number(value) : undefined)
  dureeFormation?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  certification?: string;

  // Bourse
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  paysBourse?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  niveauEtude?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => value ? Number(value) : undefined)
  montantBourse?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  estRemboursable?: boolean;

  // Volontariat
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  typeVolontariat?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => value ? Number(value) : undefined)
  dureeVolontariat?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  hebergement?: boolean;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => value ? Number(value) : undefined)
  indemnite?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  competencesRequises?: string;
}

export class UpdateOffreDto extends CreateOffreDto {}

export class OffresFilterDto {
  @ApiPropertyOptional({ enum: TypeOffre })
  @IsEnum(TypeOffre)
  @IsOptional()
  typeOffre?: TypeOffre;

  @ApiPropertyOptional({ enum: TypeEmploi })
  @IsEnum(TypeEmploi)
  @IsOptional()
  typeEmploi?: TypeEmploi;

  @ApiPropertyOptional({ enum: Secteur })
  @IsEnum(Secteur)
  @IsOptional()
  secteur?: Secteur;

  @ApiPropertyOptional({ enum: NiveauExperience })
  @IsEnum(NiveauExperience)
  @IsOptional()
  niveauExperience?: NiveauExperience;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  tag?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  keyword?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  localisation?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value) || 1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value) || 20)
  limit?: number;
}

export class PaginatedOffresResponse {
  @ApiProperty()
  data: any[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;

  @ApiProperty()
  hasMore: boolean;
}
