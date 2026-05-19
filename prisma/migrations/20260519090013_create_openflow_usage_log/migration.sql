-- CreateTable
CREATE TABLE "openflow_usage_log" (
    "id" BIGSERIAL NOT NULL,
    "account_id" TEXT NOT NULL,
    "token_last4" TEXT NOT NULL,
    "model_used" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "used_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "openflow_usage_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "openflow_usage_log_account_id_idx" ON "openflow_usage_log"("account_id");

-- CreateIndex
CREATE INDEX "openflow_usage_log_used_at_idx" ON "openflow_usage_log"("used_at");
