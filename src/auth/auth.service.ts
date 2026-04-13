import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async signup(params: { email: string; name: string; password: string }) {
    this.logger.log(`Signup attempt for email: ${params.email}, name: ${params.name}`);
    try {
      const existing = await this.users.findByEmail(params.email);
      if (existing) {
        this.logger.warn(`Signup failed: Email already in use - ${params.email}`);
        throw new BadRequestException('Email already in use');
      }

      const passwordHash = await argon2.hash(params.password);
      const user = await this.users.createLocalUser({
        email: params.email,
        name: params.name,
        passwordHash,
      });

      const accessToken = await this.signAccessToken(user.id);
      this.logger.log(`User signed up successfully: ${user.id}`);
      return { user: this.safeUser(user), accessToken };
    } catch (error) {
      this.logger.error(`Signup error for ${params.email}: ${error.message}`);
      throw error;
    }
  }

  async login(params: { email: string; password: string }) {
    this.logger.log(`Login attempt for email: ${params.email}`);
    try {
      const user = await this.users.findByEmail(params.email);
      if (!user) {
        this.logger.warn(`Login failed: User not found - ${params.email}`);
        throw new UnauthorizedException('Invalid credentials');
      }
      const ok = await argon2.verify(user.passwordHash, params.password);
      if (!ok) {
        this.logger.warn(`Login failed: Invalid password - ${params.email}`);
        throw new UnauthorizedException('Invalid credentials');
      }
      const accessToken = await this.signAccessToken(user.id);
      this.logger.log(`User logged in successfully: ${user.id}`);
      return { user: this.safeUser(user), accessToken };
    } catch (error) {
      this.logger.error(`Login error for ${params.email}: ${error.message}`);
      throw error;
    }
  }

  async oauthLogin(params: { email: string; name: string }) {
    this.logger.log(`OAuth login attempt for email: ${params.email}`);
    try {
      const user = await this.users.findOrCreateOAuthUser(params);
      const accessToken = await this.signAccessToken(user.id);
      this.logger.log(`OAuth user logged in successfully: ${user.id}`);
      return { user: this.safeUser(user), accessToken };
    } catch (error) {
      this.logger.error(`OAuth login error for ${params.email}: ${error.message}`);
      throw error;
    }
  }

  async signAccessToken(userId: string) {
    this.logger.debug(`Signing access token for user: ${userId}`);
    try {
      const token = await this.jwt.signAsync({ sub: userId });
      this.logger.debug(`Access token signed successfully for user: ${userId}`);
      return token;
    } catch (error) {
      this.logger.error(`Error signing access token for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  safeUser(user: { id: string; email: string; name: string; balanceCents: number }) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      balanceCents: user.balanceCents,
    };
  }
}

