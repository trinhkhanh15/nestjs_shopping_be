import { Controller, Get, Post, Body, Req, UseGuards, Res, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly auth: AuthService) {}

  @Post('signup')
  async signup(@Body() body: SignupDto) {
    this.logger.log(`POST /auth/signup: email=${body.email}`);
    return await this.auth.signup(body);
  }

  @Post('login')
  async login(@Body() body: LoginDto) {
    this.logger.log(`POST /auth/login: email=${body.email}`);
    return await this.auth.login(body);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: any) {
    this.logger.debug(`GET /auth/me: user=${req.user.id}`);
    return req.user;
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  async google() {
    this.logger.debug('GET /auth/google: initiating Google OAuth');
    return;
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(@Req() req: any, @Res() res: Response) {
    this.logger.log(`GET /auth/google/callback: email=${req.user.email}`);
    const { accessToken } = await this.auth.oauthLogin({
      email: req.user.email,
      name: req.user.name ?? req.user.email,
    });

    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3001';
    const redirect = new URL('/dashboard', frontendUrl);
    redirect.searchParams.set('token', accessToken);
    this.logger.debug(`Google OAuth callback redirecting to: ${redirect.toString()}`);
    return res.redirect(redirect.toString());
  }
}

