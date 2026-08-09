import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { MailService } from './mail.service';
import { CurrentUser, Roles } from '../common';
import { RolesGuard } from '../common/guards';

/**
 * Route de diagnostic de la configuration SMTP.
 *
 * Elle était auparavant annotée `@Public()` et envoyait vers une adresse
 * personnelle codée en dur : n'importe qui pouvait la solliciter en boucle pour
 * inonder cette boîte et épuiser le quota d'envoi du fournisseur.
 * Désormais réservée aux administrateurs, avec envoi vers leur propre adresse.
 */
@ApiTags('Mail')
@ApiBearerAuth()
@Controller()
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Get('test-mail')
  @UseGuards(RolesGuard)
  @Roles('ADMIN' as any)
  @Throttle({ default: { limit: 3, ttl: 300000 } })
  @ApiOperation({ summary: 'Tester la configuration SMTP (Admin)' })
  async testMail(@CurrentUser('email') email: string) {
    await this.mailService.sendTestEmail(email);
    return { message: `Email de test envoyé à ${email}` };
  }
}
