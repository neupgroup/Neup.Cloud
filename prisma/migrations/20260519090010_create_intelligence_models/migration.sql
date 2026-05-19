-- CreateTable
CREATE TABLE "intelligence_models" (
    "id" BIGSERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "description" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "rate" TEXT NOT NULL DEFAULT '0/1000',
    "costPer1000Tokens" DOUBLE PRECISION NOT NULL,
    "inputPrice" DOUBLE PRECISION NOT NULL,
    "outputPrice" DOUBLE PRECISION NOT NULL,
    "price" JSONB NOT NULL,

    CONSTRAINT "intelligence_models_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "intelligence_models_provider_model_unique" ON "intelligence_models"("provider", "model");
