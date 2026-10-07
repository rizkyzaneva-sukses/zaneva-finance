-- CreateTable
CREATE TABLE "UserBrand" (
    "userId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,

    CONSTRAINT "UserBrand_pkey" PRIMARY KEY ("userId","brandId")
);

-- CreateIndex
CREATE INDEX "UserBrand_brandId_idx" ON "UserBrand"("brandId");

-- AddForeignKey
ALTER TABLE "UserBrand" ADD CONSTRAINT "UserBrand_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBrand" ADD CONSTRAINT "UserBrand_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
