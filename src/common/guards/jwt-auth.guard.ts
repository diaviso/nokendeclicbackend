import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!isPublic) {
      return (await super.canActivate(context)) as boolean;
    }

    /*
     * Route publique : l'accès est acquis, mais on tente quand même de
     * reconnaître l'appelant.
     *
     * Sans cela, une page publique ne peut pas distinguer un visiteur d'un
     * membre connecté, et doit servir la même chose aux deux. C'est ce qui
     * permet à la fiche d'une offre d'être indexable tout en réservant son
     * contenu aux comptes.
     *
     * L'échec est ignoré, jamais propagé : un jeton absent, expiré ou abîmé
     * donne un visiteur anonyme, pas une erreur.
     */
    try {
      await super.canActivate(context);
    } catch {
      // Visiteur anonyme.
    }

    return true;
  }

  handleRequest(err: any, user: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('Token invalide ou expiré');
    }
    return user;
  }
}
