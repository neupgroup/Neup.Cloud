-- CreateTable
CREATE TABLE "intelligenceLog" (
    "id" BIGSERIAL NOT NULL,
    "access_id" BIGINT NOT NULL,
    "query" TEXT,
    "response" TEXT,
    "context" TEXT,
    "modal" TEXT,
    "currency" TEXT,
    "cost" DOUBLE PRECISION,
    "inputTokens" BIGINT,
    "outputTokens" BIGINT,
    "balance" DOUBLE PRECISION,

    CONSTRAINT "intelligenceLog_pkey" PRIMARY KEY ("id")
);
