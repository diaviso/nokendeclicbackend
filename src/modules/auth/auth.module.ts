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
    {
      // GoogleStrategy n'est instanciée que si OAuth est configuré.
      //
      // passport-oauth2 lève `OAuth2Strategy requires a clientID option` dès la
      // construction quand l'identifiant est vide, ce qui faisait échouer le
      // démarrage de TOUTE l'application — impossible de lancer le backend en
      // local, ou de déployer un environnement sans connexion Google, alors que
      // l'authentification par email fonctionne indépendamment.
      //
      // Le test se fait ici, dans une fabrique, et non au moment d'évaluer le
      // décorateur : à cet instant-là ConfigModule n'a pas encore chargé le
      // fichier .env, et la variable paraîtrait toujours absente.
      //
      // Sans configuration, les routes /auth/google répondent une erreur
      // explicite (GoogleConfiguredGuard) plutôt que d'empêcher le boot.
      provide: GoogleStrategy,
      useFactory: (configService: ConfigService) => {
        const clientId = configService.get<string>('google.clientId');
        return clientId ? new GoogleStrategy(configService) : null;
      },
      inject: [ConfigService],
    },
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
