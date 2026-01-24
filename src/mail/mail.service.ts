import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}

  async sendTestEmail(to: string) {
    await this.mailerService.sendMail({
      to,
      subject: '✅ Test email NestJS',
      html: `
        <h2>Test réussi 🎉</h2>
        <p>Ton application NestJS en local envoie des emails.</p>
        <p><b>Port :</b> localhost:3000</p>
      `,
    });
  }

  async sendVerificationCode(to: string, code: string) {
    await this.mailerService.sendMail({
      to,
      subject: '🔐 Votre code de vérification Noken',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="100%" max-width="500" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center;">
                      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">
                        🌟 Noken
                      </h1>
                      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">
                        Votre plateforme carrière en Casamance
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px 30px;">
                      <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 22px; text-align: center;">
                        Vérification de votre email
                      </h2>
                      <p style="color: #6b7280; margin: 0 0 30px 0; font-size: 16px; line-height: 1.6; text-align: center;">
                        Utilisez le code ci-dessous pour vérifier votre adresse email et activer votre compte Noken.
                      </p>
                      
                      <!-- Code Box -->
                      <div style="background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); border: 2px dashed #10b981; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 30px;">
                        <p style="color: #6b7280; margin: 0 0 8px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">
                          Votre code de vérification
                        </p>
                        <p style="color: #059669; margin: 0; font-size: 36px; font-weight: bold; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                          ${code}
                        </p>
                      </div>
                      
                      <p style="color: #9ca3af; margin: 0; font-size: 14px; text-align: center;">
                        ⏱️ Ce code expire dans <strong>15 minutes</strong>
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f9fafb; padding: 24px 30px; border-top: 1px solid #e5e7eb;">
                      <p style="color: #9ca3af; margin: 0; font-size: 12px; text-align: center; line-height: 1.6;">
                        Si vous n'avez pas demandé ce code, ignorez simplement cet email.<br>
                        © 2024 Noken - Made with ❤️ in Casamance
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });
  }
}
