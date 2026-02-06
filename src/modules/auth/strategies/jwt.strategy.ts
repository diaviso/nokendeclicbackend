import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';

export interface JwtPayload {
  sub: number;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret') ?? 'default-secret',
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        isActive: true,
        firstName: true,
        lastName: true,
        pictureUrl: true,
        statutProfessionnel: true,
        pays: true,
        commune: true,
        quartier: true,
        sexe: true,
        dateNaissance: true,
        adresse: true,
        telephone: true,
        handicap: true,
        typeHandicap: true,
        createdAt: true,
        isGoogleLogin: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Utilisateur non trouvé ou désactivé');
    }

    return user;
  }
}
