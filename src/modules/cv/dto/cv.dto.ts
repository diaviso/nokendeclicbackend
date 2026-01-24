import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
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
