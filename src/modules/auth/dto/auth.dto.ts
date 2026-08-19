import {
  Equals,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Politique de mot de passe commune à l'inscription et à la réinitialisation.
 * 10 caractères minimum avec au moins une minuscule, une majuscule et un chiffre.
 * La borne haute évite les charges utiles volumineuses côté bcrypt (coût CPU).
 */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;
export const PASSWORD_MESSAGE =
  'Le mot de passe doit contenir au moins une minuscule, une majuscule et un chiffre';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  password: string;
}

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'johndoe' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'MonMotDePasse1' })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_MESSAGE })
  password: string;

  @ApiPropertyOptional({ example: 'John' })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsString()
  @IsOptional()
  lastName?: string;

  /**
   * Acceptation des conditions générales.
   *
   * Le client transmet un accord, pas un numéro de version : c'est le serveur
   * qui consigne la version en vigueur au moment de l'inscription. Accepter
   * une version dictée par le client rendrait la trace inexploitable.
   */
  @ApiProperty({ example: true, description: 'Doit valoir true' })
  @IsBoolean()
  @Equals(true, {
    message: "Vous devez accepter les conditions générales d'utilisation",
  })
  accepteCgu: boolean;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class TokensResponse {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty()
  user: {
    id: number;
    email: string;
    username: string;
    role: string;
    firstName?: string;
    lastName?: string;
    pictureUrl?: string;
  };
}

export class GoogleUser {
  email: string;
  firstName: string;
  lastName: string;
  picture: string;
  googleId: string;
}

export class VerifyEmailDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  code: string;
}

export class ResendCodeDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'abc123token...' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ example: 'MonNouveauMotDePasse1' })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_MESSAGE })
  password: string;
}

export class ValidateResetTokenDto {
  @ApiProperty({ example: 'abc123token...' })
  @IsString()
  @IsNotEmpty()
  token: string;
}
