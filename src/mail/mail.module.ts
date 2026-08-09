import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailService } from './mail.service';
import { MailController } from './mail.controller';

// MailerModule (@nestjs-modules/mailer) retiré : MailService instancie
// désormais son transport nodemailer directement. Voir mail.service.ts.
@Module({
  imports: [ConfigModule],
  providers: [MailService],
  controllers: [MailController],
  exports: [MailService],
})
export class MailModule {}
