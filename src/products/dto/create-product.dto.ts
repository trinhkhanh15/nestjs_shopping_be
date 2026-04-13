import { IsInt, IsPositive, IsString, Min } from 'class-validator';

export class CreateProductDto {
  @IsString()
  name!: string;

  @IsInt()
  @Min(1)
  amount!: number;

  @IsInt()
  @IsPositive()
  priceCents!: number;
}

