-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_product_id_fkey";

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
