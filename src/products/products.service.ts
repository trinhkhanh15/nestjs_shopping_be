import { ForbiddenException, Injectable, Logger, NotFoundException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);
  private readonly PRODUCTS_CACHE_KEY = 'products:list';
  private readonly PRODUCTS_CACHE_TTL = 600000; // 10 minutes

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async list() {
    this.logger.log('Fetching all products');
    try {
      // Try to get from cache
      const cachedProducts = await this.cacheManager.get(this.PRODUCTS_CACHE_KEY);
      if (cachedProducts) {
        this.logger.debug('Products retrieved from cache');
        return cachedProducts;
      }

      // Cache miss - fetch from database
      this.logger.debug('Cache miss - fetching products from database');
      const products = await this.prisma.product.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          author: { select: { id: true, email: true, name: true } },
        },
      });

      // Store in cache
      await this.cacheManager.set(
        this.PRODUCTS_CACHE_KEY,
        products,
        this.PRODUCTS_CACHE_TTL,
      );
      this.logger.debug(`Retrieved ${products.length} products and cached`);
      return products;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error fetching products: ${errorMessage}`);
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
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error(`Error fetching product ${id}: ${errorMessage}`);
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

      // Invalidate products list cache
      await this.invalidateProductsCache();

      return product;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error creating product for user ${userId}: ${errorMessage}`);
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

      // Invalidate products list cache
      await this.invalidateProductsCache();

      return updatedProduct;
    } catch (error) {
      if (!(error instanceof NotFoundException || error instanceof ForbiddenException)) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error(`Error updating product ${productId}: ${errorMessage}`);
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

      // Invalidate products list cache
      await this.invalidateProductsCache();

      return { ok: true };
    } catch (error) {
      if (!(error instanceof NotFoundException || error instanceof ForbiddenException)) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error(`Error deleting product ${productId}: ${errorMessage}`);
      }
      throw error;
    }
  }

  /**
   * Helper method to invalidate the products list cache
   */
  private async invalidateProductsCache(): Promise<void> {
    try {
      await this.cacheManager.del(this.PRODUCTS_CACHE_KEY);
      this.logger.debug('Products cache invalidated');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error invalidating products cache: ${errorMessage}`);
    }
  }
}

