import { Controller, Get } from '@nestjs/common';
import { MailService } from './mail.service';
import { Public } from '../common/decorators/public.decorator';

@Controller()
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Public()
  @Get('test-mail')
  async testMail() {
    await this.mailService.sendTestEmail(
      'diavisonoo94@gmail.com',
    );
    return 'Email envoyé avec succès';
  }
}
