-- CreateTable
CREATE TABLE "accessTokens" (
    "id" BIGSERIAL NOT NULL,
    "account_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,

    CONSTRAINT "accessTokens_pkey" PRIMARY KEY ("id")
);
