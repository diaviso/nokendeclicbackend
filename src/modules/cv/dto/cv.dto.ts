import {
  ArrayMaxSize,
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  MaxLength,
  ValidateNested,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ExperienceDto {
  @ApiProperty()
  @IsString()
  poste: string;

  @ApiProperty()
  @IsString()
  entreprise: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  ville?: string;

  @ApiProperty()
  @IsDateString()
  dateDebut: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dateFin?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  enCours?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;
}

export class FormationDto {
  @ApiProperty()
  @IsString()
  diplome: string;

  @ApiProperty()
  @IsString()
  etablissement: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  ville?: string;

  @ApiProperty()
  @IsDateString()
  dateDebut: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dateFin?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  enCours?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;
}

export class CreateCVDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  titreProfessionnel?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  telephone?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  adresse?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  ville?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  codePostal?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  pays?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  linkedin?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  siteWeb?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  github?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  resume?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  competences?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  langues?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  certifications?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  interets?: string[];

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  estPublic?: boolean;

  @ApiPropertyOptional({ type: [ExperienceDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExperienceDto)
  @IsOptional()
  experiences?: ExperienceDto[];

  @ApiPropertyOptional({ type: [FormationDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormationDto)
  @IsOptional()
  formations?: FormationDto[];
}

export class UpdateCVDto extends CreateCVDto {}

/**
 * Entrée de POST /api/cv/correct.
 *
 * Ce contenu part directement dans un prompt OpenAI. Sans DTO validé, le corps de
 * requête était un `Record<string, any>` : le ValidationPipe global (qui ne
 * s'applique qu'aux classes) était inopérant, et n'importe quel utilisateur
 * authentifié pouvait envoyer une charge utile arbitrairement volumineuse.
 * Les bornes ci-dessous plafonnent le coût par appel.
 */
export class CorrectExperienceDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  poste: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  entreprise: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(200)
  @IsOptional()
  ville?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(4000)
  @IsOptional()
  description?: string;
}

export class CorrectFormationDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  diplome: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  etablissement: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(200)
  @IsOptional()
  ville?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(4000)
  @IsOptional()
  description?: string;
}

export class CorrectCVDto {
  @ApiPropertyOptional()
  @IsString()
  @MaxLength(300)
  @IsOptional()
  titreProfessionnel?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(5000)
  @IsOptional()
  resume?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  @IsOptional()
  competences?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  @IsOptional()
  langues?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  @IsOptional()
  certifications?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  @IsOptional()
  interets?: string[];

  @ApiPropertyOptional({ type: [CorrectExperienceDto] })
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => CorrectExperienceDto)
  @IsOptional()
  experiences?: CorrectExperienceDto[];

  @ApiPropertyOptional({ type: [CorrectFormationDto] })
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => CorrectFormationDto)
  @IsOptional()
  formations?: CorrectFormationDto[];
}
