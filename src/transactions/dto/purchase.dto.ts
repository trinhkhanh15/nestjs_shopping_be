import { IsString } from 'class-validator';

export class PurchaseDto {
  @IsString()
  productId!: string;
}

