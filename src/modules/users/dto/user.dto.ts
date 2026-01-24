import { IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator';
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

  @ApiProperty()
  createdAt: Date;
}
