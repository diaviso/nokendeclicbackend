import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MESSAGE,
  PASSWORD_MIN_LENGTH,
  PASSWORD_PATTERN,
} from '../../auth/dto/auth.dto';

/**
 * Mot de passe défini par l'administration pour un autre compte.
 *
 * Les mêmes exigences qu'à l'inscription, reprises depuis leur source unique :
 * un mot de passe posé depuis la console n'a aucune raison d'être plus faible
 * que celui qu'on demande à l'intéressé.
 */
export class DefinirMotDePasseDto {
  @ApiProperty({ example: 'MonMotDePasse1' })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_MESSAGE })
  motDePasse: string;
}
