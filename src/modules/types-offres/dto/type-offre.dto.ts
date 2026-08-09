import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum TypeChampDto {
  TEXTE = 'TEXTE',
  TEXTE_LONG = 'TEXTE_LONG',
  NOMBRE = 'NOMBRE',
  DATE = 'DATE',
  BOOLEEN = 'BOOLEEN',
  LISTE = 'LISTE',
  URL = 'URL',
}

/**
 * Le code sert de clé dans `Offre.champs` et apparaît dans les URL de filtre.
 * Contraint en majuscules et tiret bas pour rester stable et lisible.
 */
const CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,39}$/;
const CODE_MESSAGE =
  'Le code doit être en majuscules, sans espace (lettres, chiffres et tiret bas), de 2 à 40 caractères';

export class ChampTypeOffreDto {
  @ApiPropertyOptional({ description: 'Présent lors d’une mise à jour' })
  @IsInt()
  @IsOptional()
  id?: number;

  @ApiProperty({ example: 'organisme' })
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  @Matches(/^[a-zA-Z][a-zA-Z0-9_]*$/, {
    message: 'Le code du champ doit commencer par une lettre, sans espace',
  })
  code: string;

  @ApiProperty({ example: 'Organisme' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  libelle: string;

  @ApiProperty({ enum: TypeChampDto })
  @IsEnum(TypeChampDto)
  type: TypeChampDto;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  obligatoire?: boolean;

  @ApiPropertyOptional({ type: [String], description: 'Requis si type = LISTE' })
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  @IsOptional()
  options?: string[];

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(120)
  @IsOptional()
  placeholder?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(200)
  @IsOptional()
  aide?: string;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  ordre?: number;
}

export class CreateTypeOffreDto {
  @ApiProperty({ example: 'CONCOURS' })
  @IsString()
  @Matches(CODE_PATTERN, { message: CODE_MESSAGE })
  code: string;

  @ApiProperty({ example: 'Concours' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  libelle: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(300)
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Nom d’icône Lucide' })
  @IsString()
  @MaxLength(40)
  @IsOptional()
  icone?: string;

  @ApiPropertyOptional({ description: 'Clé de couleur de la palette' })
  @IsString()
  @MaxLength(20)
  @IsOptional()
  couleur?: string;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  ordre?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  estActif?: boolean;

  @ApiPropertyOptional({ type: [ChampTypeOffreDto] })
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ChampTypeOffreDto)
  @IsOptional()
  champs?: ChampTypeOffreDto[];
}

/**
 * Le code est absent de la mise à jour : il est immuable une fois le type créé.
 * Le modifier invaliderait les liens partagés et les filtres déjà indexés.
 */
export class UpdateTypeOffreDto {
  @ApiPropertyOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  @IsOptional()
  libelle?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(300)
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(40)
  @IsOptional()
  icone?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(20)
  @IsOptional()
  couleur?: string;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  ordre?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  estActif?: boolean;

  @ApiPropertyOptional({
    type: [ChampTypeOffreDto],
    description:
      'Remplace intégralement la liste des champs. Les champs absents sont supprimés.',
  })
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ChampTypeOffreDto)
  @IsOptional()
  champs?: ChampTypeOffreDto[];
}
