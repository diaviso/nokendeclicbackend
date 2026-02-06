import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto, GoogleUser } from './dto';
import { MailService } from '../../mail/mail.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailService: MailService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      if (!(existingUser as any).isEmailVerified) {
        // Resend verification code
        await this.sendVerificationCode(existingUser.id, existingUser.email);
        return { message: 'Un code de vérification a été renvoyé à votre email' };
      }
      throw new ConflictException('Un utilisateur avec cet email existe déjà');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username || dto.email.split('@')[0],
        password: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        isGoogleLogin: false,
        isEmailVerified: false,
      },
    });

    // Send verification code
    await this.sendVerificationCode(user.id, user.email);

    return { message: 'Un code de vérification a été envoyé à votre email' };
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.password) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Votre compte a été désactivé');
    }

    // Check if email is verified
    if (!(user as any).isEmailVerified && !user.isGoogleLogin) {
      await this.sendVerificationCode(user.id, user.email);
      return { requiresVerification: true, message: 'Veuillez vérifier votre email' };
    }

    return this.generateTokens(user);
  }

  async verifyEmail(email: string, code: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new BadRequestException('Utilisateur non trouvé');
    }

    const verification = await this.prisma.emailVerification.findFirst({
      where: {
        userId: user.id,
        code,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!verification) {
      throw new BadRequestException('Code de vérification invalide ou expiré');
    }

    // Mark email as verified
    await this.prisma.user.update({
      where: { id: user.id },
      data: { isEmailVerified: true },
    });

    // Delete all verification codes for this user
    await this.prisma.emailVerification.deleteMany({
      where: { userId: user.id },
    });

    return this.generateTokens(user);
  }

  async resendVerificationCode(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new BadRequestException('Utilisateur non trouvé');
    }

    if ((user as any).isEmailVerified) {
      throw new BadRequestException('Email déjà vérifié');
    }

    await this.sendVerificationCode(user.id, user.email);
    return { message: 'Un nouveau code a été envoyé' };
  }

  private async sendVerificationCode(userId: number, email: string) {
    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Delete old codes
    await this.prisma.emailVerification.deleteMany({
      where: { userId },
    });

    // Save new code (expires in 15 minutes)
    await this.prisma.emailVerification.create({
      data: {
        userId,
        code,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    // Send email
    try {
      await this.mailService.sendVerificationCode(email, code);
      console.log(`Verification code sent to ${email}: ${code}`);
    } catch (error) {
      console.error(`Failed to send verification email to ${email}:`, error);
      // Log the code for development purposes
      console.log(`[DEV] Verification code for ${email}: ${code}`);
    }
  }

  async googleLogin(googleUser: GoogleUser) {
    let user = await this.prisma.user.findUnique({
      where: { googleId: googleUser.googleId },
    });

    if (!user) {
      user = await this.prisma.user.findUnique({
        where: { email: googleUser.email },
      });

      if (user) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            googleId: googleUser.googleId,
            pictureUrl: googleUser.picture,
            isGoogleLogin: true,
          },
        });
      } else {
        user = await this.prisma.user.create({
          data: {
            email: googleUser.email,
            username: googleUser.email.split('@')[0],
            firstName: googleUser.firstName,
            lastName: googleUser.lastName,
            pictureUrl: googleUser.picture,
            googleId: googleUser.googleId,
            isGoogleLogin: true,
          },
        });
      }
    } else {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          pictureUrl: googleUser.picture,
          firstName: googleUser.firstName,
          lastName: googleUser.lastName,
        },
      });
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Votre compte a été désactivé');
    }

    return this.generateTokens(user);
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || user.refreshToken !== refreshToken) {
        throw new UnauthorizedException('Token de rafraîchissement invalide');
      }

      if (!user.isActive) {
        throw new UnauthorizedException('Votre compte a été désactivé');
      }

      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('Token de rafraîchissement invalide ou expiré');
    }
  }

  async logout(userId: number) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
    return { message: 'Déconnexion réussie' };
  }

  private async generateTokens(user: any) {
    const payload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.secret') ?? 'default-secret',
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(
      { sub: user.id },
      {
        secret: this.configService.get<string>('jwt.refreshSecret') ?? 'default-refresh-secret',
        expiresIn: '7d',
      },
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        pictureUrl: user.pictureUrl,
      },
    };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return { message: 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé' };
    }

    // Check if user is a Google login user
    if (user.isGoogleLogin && !user.password) {
      return { message: 'Ce compte utilise la connexion Google. Veuillez vous connecter avec Google.' };
    }

    // Generate unique token
    const token = require('crypto').randomBytes(32).toString('hex');

    // Delete old reset tokens
    await this.prisma.passwordReset.deleteMany({
      where: { userId: user.id },
    });

    // Save new token (expires in 1 hour)
    await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    // Build reset link
    const frontendUrl = this.configService.get<string>('frontend.url') || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;

    // Send email
    try {
      await this.mailService.sendPasswordResetEmail(email, resetLink);
      console.log(`Password reset email sent to ${email}`);
    } catch (error) {
      console.error(`Failed to send password reset email to ${email}:`, error);
      console.log(`[DEV] Reset link for ${email}: ${resetLink}`);
    }

    return { message: 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé' };
  }

  async resetPassword(token: string, newPassword: string) {
    const resetRecord = await this.prisma.passwordReset.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetRecord) {
      throw new BadRequestException('Lien de réinitialisation invalide');
    }

    if (resetRecord.expiresAt < new Date()) {
      await this.prisma.passwordReset.delete({ where: { id: resetRecord.id } });
      throw new BadRequestException('Ce lien a expiré. Veuillez demander un nouveau lien.');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update user password
    await this.prisma.user.update({
      where: { id: resetRecord.userId },
      data: { password: hashedPassword },
    });

    // Delete all reset tokens for this user
    await this.prisma.passwordReset.deleteMany({
      where: { userId: resetRecord.userId },
    });

    return { message: 'Votre mot de passe a été réinitialisé avec succès' };
  }

  async validateResetToken(token: string) {
    const resetRecord = await this.prisma.passwordReset.findUnique({
      where: { token },
    });

    if (!resetRecord) {
      throw new BadRequestException('Lien de réinitialisation invalide');
    }

    if (resetRecord.expiresAt < new Date()) {
      await this.prisma.passwordReset.delete({ where: { id: resetRecord.id } });
      throw new BadRequestException('Ce lien a expiré');
    }

    return { valid: true };
  }
}
