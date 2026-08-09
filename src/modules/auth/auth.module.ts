import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { MailModule } from '../../mail/mail.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService): Promise<JwtModuleOptions> => ({
        secret: configService.get<string>('jwt.secret') ?? 'default-secret',
        signOptions: {
          expiresIn: '15m',
        },
      }),
      inject: [ConfigService],
    }),
    MailModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    // GoogleStrategy n'est enregistrée que si OAuth est configuré.
    //
    // passport-oauth2 lève `OAuth2Strategy requires a clientID option` dès la
    // construction quand l'identifiant est vide, ce qui faisait échouer le
    // démarrage de TOUTE l'application — impossible de lancer le backend en
    // local, ou de déployer un environnement sans connexion Google, alors que
    // l'authentification par email fonctionne indépendamment.
    //
    // Sans configuration, les routes /auth/google répondent une erreur
    // explicite (voir AuthController) au lieu d'empêcher le boot.
    ...(process.env.GOOGLE_CLIENT_ID ? [GoogleStrategy] : []),
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
