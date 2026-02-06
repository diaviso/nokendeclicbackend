import { IsString, IsOptional, IsEnum, IsBoolean, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum Role {
  ADMIN = 'ADMIN',
  MEMBRE = 'MEMBRE',
  PARTENAIRE = 'PARTENAIRE',
}

export enum StatutProfessionnel {
  NON_PRECISE = 'NON_PRECISE',
  EN_RECHERCHE = 'EN_RECHERCHE',
  EN_POSTE = 'EN_POSTE',
  ETUDIANT = 'ETUDIANT',
  FREELANCE = 'FREELANCE',
  CHOMAGE = 'CHOMAGE',
  RECONVERSION = 'RECONVERSION',
}

export enum Sexe {
  HOMME = 'HOMME',
  FEMME = 'FEMME',
  AUTRE = 'AUTRE',
  NON_PRECISE = 'NON_PRECISE',
}

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  username?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  pictureUrl?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  pays?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  commune?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  quartier?: string;

  @ApiPropertyOptional()
  @IsEnum(StatutProfessionnel)
  @IsOptional()
  statutProfessionnel?: StatutProfessionnel;

  @ApiPropertyOptional({ enum: Sexe })
  @IsEnum(Sexe)
  @IsOptional()
  sexe?: Sexe;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  @Transform(({ value }) => value === '' ? undefined : value)
  dateNaissance?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  adresse?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  telephone?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  handicap?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  typeHandicap?: string;
}

export class ChangeRoleDto {
  @ApiProperty({ enum: Role })
  @IsEnum(Role)
  role: Role;
}

export class ChangeStatutDto {
  @ApiProperty({ enum: StatutProfessionnel })
  @IsEnum(StatutProfessionnel)
  statutProfessionnel: StatutProfessionnel;
}

export class ToggleActiveDto {
  @ApiProperty()
  @IsBoolean()
  isActive: boolean;
}

export class UserResponse {
  @ApiProperty()
  id: number;

  @ApiProperty()
  email: string;

  @ApiProperty()
  username: string;

  @ApiProperty({ enum: Role })
  role: Role;

  @ApiProperty()
  isActive: boolean;

  @ApiPropertyOptional()
  pictureUrl?: string;

  @ApiPropertyOptional()
  firstName?: string;

  @ApiPropertyOptional()
  lastName?: string;

  @ApiProperty({ enum: StatutProfessionnel })
  statutProfessionnel: StatutProfessionnel;

  @ApiPropertyOptional()
  pays?: string;

  @ApiPropertyOptional()
  commune?: string;

  @ApiPropertyOptional()
  quartier?: string;

  @ApiPropertyOptional({ enum: Sexe })
  sexe?: Sexe;

  @ApiPropertyOptional()
  dateNaissance?: Date;

  @ApiPropertyOptional()
  adresse?: string;

  @ApiPropertyOptional()
  telephone?: string;

  @ApiPropertyOptional()
  handicap?: boolean;

  @ApiPropertyOptional()
  typeHandicap?: string;

  @ApiProperty()
  createdAt: Date;
}
