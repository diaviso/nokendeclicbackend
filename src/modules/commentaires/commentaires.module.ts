import { Module, forwardRef } from '@nestjs/common';
import { CommentairesController } from './commentaires.controller';
import { CommentairesService } from './commentaires.service';
import { ModerationService } from './moderation.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [forwardRef(() => NotificationsModule)],
  controllers: [CommentairesController],
  providers: [CommentairesService, ModerationService],
  exports: [CommentairesService],
})
export class CommentairesModule {}
