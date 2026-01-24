import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

import { configuration } from './config';
import { PrismaModule } from './prisma';
import { JwtAuthGuard, AllExceptionsFilter } from './common';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OffresModule } from './modules/offres/offres.module';
import { CVModule } from './modules/cv/cv.module';
import { MessagesModule } from './modules/messages/messages.module';
import { CommentairesModule } from './modules/commentaires/commentaires.module';
import { RetoursModule } from './modules/retours/retours.module';
import { ChatbotModule } from './modules/chatbot/chatbot.module';
import { AdminModule } from './modules/admin/admin.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { MailModule } from './mail/mail.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    OffresModule,
    CVModule,
    MessagesModule,
    CommentairesModule,
    RetoursModule,
    ChatbotModule,
    AdminModule,
    FavoritesModule,
    MailModule,
    MessagingModule,
    NotificationsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
