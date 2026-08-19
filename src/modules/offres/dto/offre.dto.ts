import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsNumber,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
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
  @MaxLength(20000)
  description: string;

  /**
   * Balisage produit par l'éditeur. Assaini côté serveur avant enregistrement :
   * ce qui arrive ici n'est pas ce qui sera stocké, et encore moins affiché.
   */
  @ApiPropertyOptional({ description: "Contenu riche de l'annonce" })
  @IsString()
  @MaxLength(120000)
  @IsOptional()
  contenuHtml?: string;

  @ApiPropertyOptional({ description: 'Accroche pour les listes et les partages' })
  @IsString()
  @MaxLength(400)
  @IsOptional()
  extrait?: string;

  @ApiPropertyOptional({ description: 'Enregistrer sans publier' })
  @IsBoolean()
  @IsOptional()
  estBrouillon?: boolean;

  @ApiPropertyOptional({ description: 'Publier à partir de cette date' })
  @IsDateString()
  @IsOptional()
  datePublicationPrevue?: string;

  @ApiPropertyOptional({ description: "Texte alternatif de l'image de couverture" })
  @IsString()
  @MaxLength(300)
  @IsOptional()
  imageAlt?: string;

  @ApiPropertyOptional({ description: 'Titre affiché dans les moteurs de recherche' })
  @IsString()
  @MaxLength(70)
  @IsOptional()
  metaTitre?: string;

  @ApiPropertyOptional({ description: 'Description affichée dans les moteurs' })
  @IsString()
  @MaxLength(180)
  @IsOptional()
  metaDescription?: string;

  @ApiPropertyOptional({ example: 250000 })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  salaireMin?: number;

  @ApiPropertyOptional({ example: 400000 })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  salaireMax?: number;

  @ApiPropertyOptional({ example: 'FCFA' })
  @IsString()
  @MaxLength(10)
  @IsOptional()
  salaireDevise?: string;

  @ApiPropertyOptional({ example: 'mois' })
  @IsString()
  @MaxLength(20)
  @IsOptional()
  salairePeriode?: string;

  @ApiPropertyOptional({ example: 'hybride' })
  @IsString()
  @MaxLength(20)
  @IsOptional()
  teletravail?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  nombrePostes?: number;

  @ApiPropertyOptional({ example: 'recrutement@exemple.sn' })
  @IsEmail()
  @MaxLength(200)
  @IsOptional()
  emailCandidature?: string;

  @ApiPropertyOptional({ description: 'Pièces à fournir, marche à suivre' })
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  instructionsCandidature?: string;

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
