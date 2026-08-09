import {
  CanActivate,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Vérifie que la connexion Google est configurée avant de laisser passer la
 * requête vers la stratégie Passport.
 *
 * La stratégie n'est enregistrée que si `GOOGLE_CLIENT_ID` est renseigné (voir
 * AuthModule) : sans ce contrôle, l'appel échouerait sur un « Unknown
 * authentication strategy » peu parlant. Placée avant `AuthGuard('google')`,
 * cette garde renvoie un message exploitable.
 */
@Injectable()
export class GoogleConfiguredGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(): boolean {
    const clientId = this.configService.get<string>('google.clientId');
    if (!clientId) {
      throw new ServiceUnavailableException(
        "La connexion Google n'est pas configurée sur ce serveur. " +
          'Utilisez la connexion par email et mot de passe.',
      );
    }
    return true;
  }
}
