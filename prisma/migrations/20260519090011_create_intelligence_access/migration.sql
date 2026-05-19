-- CreateTable
CREATE TABLE "intelligenceAccess" (
    "id" BIGSERIAL NOT NULL,
    "prompt_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "model" TEXT,
    "primaryModel" TEXT,
    "fallbackModel" TEXT,
    "maxTokens" INTEGER,
    "defPrompt" TEXT,
    "balance" DOUBLE PRECISION NOT NULL,
    "primaryAccessKey" BIGINT,
    "fallbackAccessKey" BIGINT,
    "primaryModelConfig" JSONB,
    "fallbackModelConfig" JSONB,

    CONSTRAINT "intelligenceAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "intelligenceAccess_account_prompt_unique" ON "intelligenceAccess"("account_id", "prompt_id");
