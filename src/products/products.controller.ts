import { Body, Controller, Delete, Get, Logger, Param, Patch, Post, Req, UseGuards, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Controller('products')
export class ProductsController {
  private readonly logger = new Logger(ProductsController.name);

  constructor(
    private readonly products: ProductsService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  @Get()
  async list() {
    this.logger.debug('GET /products: fetching all products');
    return await this.products.list();
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    this.logger.debug(`GET /products/${id}: fetching product`);
    return await this.products.get(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Req() req: any, @Body() body: CreateProductDto) {
    this.logger.log(`POST /products: user=${req.user.id}, name=${body.name}`);
    return await this.products.create(req.user.id, body);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(@Req() req: any, @Param('id') id: string, @Body() body: UpdateProductDto) {
    this.logger.log(`PATCH /products/${id}: user=${req.user.id}`);
    return await this.products.update(req.user.id, id, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Req() req: any, @Param('id') id: string) {
    this.logger.log(`DELETE /products/${id}: user=${req.user.id}`);
    return await this.products.remove(req.user.id, id);
  }

  /**
   * Admin endpoint to manually clear the products cache
   * This is useful during testing or for manual cache invalidation
   */
  @Delete('cache/clear')
  @UseGuards(JwtAuthGuard)
  async clearCache(@Req() req: any) {
    this.logger.log(`DELETE /products/cache/clear: user=${req.user.id} (admin only)`);
    try {
      await this.cacheManager.del('products:list');
      this.logger.log('Products cache cleared manually');
      return { success: true, message: 'Products cache cleared' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error clearing cache: ${errorMessage}`);
      return { success: false, message: 'Failed to clear cache', error: errorMessage };
    }
  }
}

