import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list() {
    this.logger.log('Fetching all products');
    try {
      const products = await this.prisma.product.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          author: { select: { id: true, email: true, name: true } },
        },
      });
      this.logger.debug(`Retrieved ${products.length} products`);
      return products;
    } catch (error) {
      this.logger.error(`Error fetching products: ${error.message}`);
      throw error;
    }
  }

  async get(id: string) {
    this.logger.debug(`Fetching product: ${id}`);
    try {
      const product = await this.prisma.product.findUnique({
        where: { id },
        include: { author: { select: { id: true, email: true, name: true } } },
      });
      if (!product) {
        this.logger.warn(`Product not found: ${id}`);
        throw new NotFoundException('Product not found');
      }
      this.logger.debug(`Product retrieved successfully: ${id}`);
      return product;
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        this.logger.error(`Error fetching product ${id}: ${error.message}`);
      }
      throw error;
    }
  }

  async create(userId: string, data: { name: string; amount: number; priceCents: number }) {
    this.logger.log(`Creating product for user ${userId}: name=${data.name}, amount=${data.amount}, price=${data.priceCents}`);
    try {
      const product = await this.prisma.product.create({
        data: {
          name: data.name,
          amount: data.amount,
          priceCents: data.priceCents,
          authorID: userId,
        },
      });
      this.logger.log(`Product created successfully: ${product.id}`);
      return product;
    } catch (error) {
      this.logger.error(`Error creating product for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  async update(userId: string, productId: string, data: any) {
    this.logger.log(`Updating product ${productId} by user ${userId}`);
    try {
      const product = await this.prisma.product.findUnique({ where: { id: productId } });
      if (!product) {
        this.logger.warn(`Product not found for update: ${productId}`);
        throw new NotFoundException('Product not found');
      }
      if (product.authorID !== userId) {
        this.logger.warn(`Unauthorized update attempt: user ${userId} trying to update product of user ${product.authorID}`);
        throw new ForbiddenException('Not your product');
      }

      const updatedProduct = await this.prisma.product.update({
        where: { id: productId },
        data,
      });
      this.logger.log(`Product updated successfully: ${productId}`);
      return updatedProduct;
    } catch (error) {
      if (!(error instanceof NotFoundException || error instanceof ForbiddenException)) {
        this.logger.error(`Error updating product ${productId}: ${error.message}`);
      }
      throw error;
    }
  }

  async remove(userId: string, productId: string) {
    this.logger.log(`Deleting product ${productId} by user ${userId}`);
    try {
      const product = await this.prisma.product.findUnique({ where: { id: productId } });
      if (!product) {
        this.logger.warn(`Product not found for deletion: ${productId}`);
        throw new NotFoundException('Product not found');
      }
      if (product.authorID !== userId) {
        this.logger.warn(`Unauthorized deletion attempt: user ${userId} trying to delete product of user ${product.authorID}`);
        throw new ForbiddenException('Not your product');
      }

      await this.prisma.product.delete({ where: { id: productId } });
      this.logger.log(`Product deleted successfully: ${productId}`);
      return { ok: true };
    } catch (error) {
      if (!(error instanceof NotFoundException || error instanceof ForbiddenException)) {
        this.logger.error(`Error deleting product ${productId}: ${error.message}`);
      }
      throw error;
    }
  }
}

