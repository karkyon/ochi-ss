-- CreateTable
CREATE TABLE "chamfer_rules" (
    "id" TEXT NOT NULL,
    "materialCode" VARCHAR(4) NOT NULL,
    "processingSpecCode" INTEGER NOT NULL,
    "sizeAFrom" DECIMAL(7,3),
    "sizeATo" DECIMAL(7,3),
    "sizeBFrom" DECIMAL(7,3),
    "sizeBTo" DECIMAL(7,3),
    "limitChamfer4" DECIMAL(7,3),
    "limitChamfer8" DECIMAL(7,3),
    "maxChamfer4" DECIMAL(7,3),
    "maxChamfer8" DECIMAL(7,3),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chamfer_rules_pkey" PRIMARY KEY ("id")
);
