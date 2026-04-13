import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string) {
    this.logger.debug(`Finding user by email: ${email}`);
    try {
      const user = await this.prisma.user.findUnique({ where: { email } });
      if (user) {
        this.logger.debug(`User found for email: ${email}`);
      } else {
        this.logger.debug(`User not found for email: ${email}`);
      }
      return user;
    } catch (error) {
      this.logger.error(`Error finding user by email ${email}: ${error.message}`);
      throw error;
    }
  }

  async findById(id: string) {
    this.logger.debug(`Finding user by id: ${id}`);
    try {
      const user = await this.prisma.user.findUnique({ where: { id } });
      if (user) {
        this.logger.debug(`User found for id: ${id}`);
      } else {
        this.logger.debug(`User not found for id: ${id}`);
      }
      return user;
    } catch (error) {
      this.logger.error(`Error finding user by id ${id}: ${error.message}`);
      throw error;
    }
  }

  async createLocalUser(params: { email: string; name: string; passwordHash: string }) {
    this.logger.log(`Creating local user with email: ${params.email}, name: ${params.name}`);
    try {
      const user = await this.prisma.user.create({
        data: {
          email: params.email,
          name: params.name,
          passwordHash: params.passwordHash,
        },
      });
      this.logger.log(`Local user created successfully: ${user.id}`);
      return user;
    } catch (error) {
      this.logger.error(`Error creating local user: ${error.message}`);
      throw error;
    }
  }

  async findOrCreateOAuthUser(params: { email: string; name: string }) {
    this.logger.log(`Finding or creating OAuth user with email: ${params.email}`);
    try {
      const existing = await this.findByEmail(params.email);
      if (existing) {
        this.logger.debug(`OAuth user already exists: ${existing.id}`);
        return existing;
      }
      const user = await this.prisma.user.create({
        data: {
          email: params.email,
          name: params.name,
          passwordHash: 'OAUTH',
        },
      });
      this.logger.log(`OAuth user created successfully: ${user.id}`);
      return user;
    } catch (error) {
      this.logger.error(`Error finding or creating OAuth user: ${error.message}`);
      throw error;
    }
  }
}

