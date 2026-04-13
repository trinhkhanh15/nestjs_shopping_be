/*
  Warnings:

  - You are about to drop the column `price` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `money_amount` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `balance` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `User` table. All the data in the column will be lost.
  - Added the required column `priceCents` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `moneyAmountCents` to the `Transaction` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Product" DROP COLUMN "price",
ADD COLUMN     "priceCents" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "money_amount",
ADD COLUMN     "moneyAmountCents" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "balance",
DROP COLUMN "password",
ADD COLUMN     "balanceCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "passwordHash" TEXT NOT NULL DEFAULT '';
