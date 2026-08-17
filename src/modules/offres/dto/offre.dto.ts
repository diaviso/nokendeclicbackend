import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsNumber,
  IsArray,
  IsBoolean,
  IsDateString,
  IsObject,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

/**
 * Ancienne énumération des types d'offre, conservée uniquement pour la
 * compatibilité de lecture (filtres `typeOffre=EMPLOI` déjà partagés). Les
 * types sont désormais administrables : voir le module types-offres.
 */
export enum TypeOffre {
  EMPLOI = 'EMPLOI',
  FORMATION = 'FORMATION',
  BOURSE = 'BOURSE',
  VOLONTARIAT = 'VOLONTARIAT',
  PROGRAMME = 'PROGRAMME',
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

export class ChampsLegacyDto {
  @ApiPropertyOptional({ deprecated: true })
  @IsNumber()
  @IsOptional()
  salaireMin?: number;

  @ApiPropertyOptional({ deprecated: true })
  @IsNumber()
  @IsOptional()
  salaireMax?: number;

  @ApiPropertyOptional({ deprecated: true })
  @IsString()
  @IsOptional()
  devise?: string;

  @ApiPropertyOptional({ deprecated: true })
  @IsString()
  @IsOptional()
  organisme?: string;

  @ApiPropertyOptional({ deprecated: true })
  @IsNumber()
  @IsOptional()
  dureeFormation?: number;

  @ApiPropertyOptional({ deprecated: true })
  @IsString()
  @IsOptional()
  certification?: string;

  @ApiPropertyOptional({ deprecated: true })
  @IsString()
  @IsOptional()
  paysBourse?: string;

  @ApiPropertyOptional({ deprecated: true })
  @IsString()
  @IsOptional()
  niveauEtude?: string;

  @ApiPropertyOptional({ deprecated: true })
  @IsNumber()
  @IsOptional()
  montantBourse?: number;

  @ApiPropertyOptional({ deprecated: true })
  @IsBoolean()
  @IsOptional()
  estRemboursable?: boolean;

  @ApiPropertyOptional({ deprecated: true })
  @IsString()
  @IsOptional()
  typeVolontariat?: string;

  @ApiPropertyOptional({ deprecated: true })
  @IsNumber()
  @IsOptional()
  dureeVolontariat?: number;

  @ApiPropertyOptional({ deprecated: true })
  @IsBoolean()
  @IsOptional()
  hebergement?: boolean;

  @ApiPropertyOptional({ deprecated: true })
  @IsNumber()
  @IsOptional()
  indemnite?: number;

  @ApiPropertyOptional({ deprecated: true })
  @IsString()
  @IsOptional()
  competencesRequises?: string;
}

export class CreateOffreDto extends ChampsLegacyDto {
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

  @ApiPropertyOptional({ example: 1, description: "Identifiant du type d'offre" })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  typeOffreId?: number;

  /**
   * Compatibilité : l'ancien back-office envoie le code du type
   * (`typeOffre: "EMPLOI"`) et non son identifiant. Le service résout l'un ou
   * l'autre. À retirer une fois l'ancien front déposé.
   */
  @ApiPropertyOptional({ example: 'EMPLOI', deprecated: true })
  @IsString()
  @MaxLength(40)
  @IsOptional()
  typeOffre?: string;

  /**
   * Valeurs des champs définis par le type choisi, indexées par leur code.
   * Validées et normalisées par TypesOffresService avant enregistrement : ce
   * DTO n'en connaît pas la forme, qui dépend du type sélectionné.
   */
  @ApiPropertyOptional({
    description: 'Valeurs des champs propres au type, indexées par code',
  })
  @IsObject()
  @IsOptional()
  champs?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'URL de la photo de couverture' })
  @IsString()
  @IsOptional()
  imageUrl?: string;

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

}

/**
 * Champs spécifiques de l'ancien modèle, encore envoyés à plat par le
 * back-office Vite. Ils sont repliés dans `champs` par le service.
 *
 * Sans ces déclarations, la validation globale (`forbidNonWhitelisted`) les
 * rejetterait en 400 : créer ou modifier une offre depuis l'ancienne interface
 * deviendrait impossible du jour au lendemain.
 *
 * À supprimer une fois l'ancien front déposé.
 */
/** Codes des champs hérités, repliés dans `champs` par le service. */
export const CHAMPS_LEGACY = [
  'salaireMin',
  'salaireMax',
  'devise',
  'organisme',
  'dureeFormation',
  'certification',
  'paysBourse',
  'niveauEtude',
  'montantBourse',
  'estRemboursable',
  'typeVolontariat',
  'dureeVolontariat',
  'hebergement',
  'indemnite',
  'competencesRequises',
] as const;

export class UpdateOffreDto extends CreateOffreDto {}

export class OffresFilterDto {
  /**
   * Filtre par code de type (EMPLOI, FORMATION, ou tout code créé depuis le
   * back-office). Une chaîne libre et non plus une énumération : les types sont
   * administrables. Les liens déjà partagés du type `?typeOffre=EMPLOI`
   * continuent donc de fonctionner.
   */
  @ApiPropertyOptional({ example: 'EMPLOI' })
  @IsString()
  @MaxLength(40)
  @IsOptional()
  typeOffre?: string;

  @ApiPropertyOptional({ description: 'Filtre par identifiant de type' })
  @IsInt()
  @Type(() => Number)
  @IsOptional()
  typeOffreId?: number;

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

/** Décision de modération prise par l'administration sur une offre déposée. */
export class ModererOffreDto {
  @ApiProperty({ enum: ['PUBLIEE', 'REFUSEE'] })
  @IsEnum(['PUBLIEE', 'REFUSEE'])
  statut: 'PUBLIEE' | 'REFUSEE';

  /**
   * Obligatoire en cas de refus — contrôlé dans le service, où l'on connaît le
   * statut. Sans motif, le partenaire ne peut pas corriger : il ne sait pas ce
   * qui a été reproché à son annonce.
   */
  @ApiPropertyOptional()
  @IsString()
  @MaxLength(500)
  @IsOptional()
  motif?: string;
}
