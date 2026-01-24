import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, RefreshTokenDto, TokensResponse, VerifyEmailDto, ResendCodeDto } from './dto';
import { Public, CurrentUser } from '../../common';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Inscription avec email/password' })
  @ApiResponse({ status: 201, type: TokensResponse })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Connexion avec email/password' })
  @ApiResponse({ status: 200, type: TokensResponse })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Initier la connexion Google OAuth2' })
  async googleAuth() {
    // Redirige vers Google
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Callback Google OAuth2' })
  async googleAuthCallback(@Req() req: any, @Res() res: Response) {
    const tokens = await this.authService.googleLogin(req.user);
    const frontendUrl = this.configService.get<string>('frontend.url');
    
    // Rediriger vers le frontend avec les tokens
    res.redirect(
      `${frontendUrl}/auth/callback?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`,
    );
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rafraîchir les tokens' })
  @ApiResponse({ status: 200, type: TokensResponse })
  async refreshTokens(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Déconnexion' })
  async logout(@CurrentUser('id') userId: number) {
    return this.authService.logout(userId);
  }

  @Get('me')
  @ApiOperation({ summary: 'Obtenir l\'utilisateur connecté' })
  async getMe(@CurrentUser() user: any) {
    return user;
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Vérifier l\'email avec le code à 6 chiffres' })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.email, dto.code);
  }

  @Public()
  @Post('resend-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renvoyer le code de vérification' })
  async resendCode(@Body() dto: ResendCodeDto) {
    return this.authService.resendVerificationCode(dto.email);
  }

  @Public()
  @Get('info')
  @ApiOperation({ summary: 'Informations sur l\'authentification' })
  getAuthInfo() {
    return {
      message: 'API d\'authentification Noken Declic',
      methods: ['Google OAuth2', 'Email/Password'],
      endpoints: {
        register: 'POST /auth/register',
        login: 'POST /auth/login',
        verifyEmail: 'POST /auth/verify-email',
        resendCode: 'POST /auth/resend-code',
        google: 'GET /auth/google',
        refresh: 'POST /auth/refresh',
        logout: 'POST /auth/logout',
        me: 'GET /auth/me',
      },
    };
  }
}
