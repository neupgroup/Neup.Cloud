-- CreateTable
CREATE TABLE "pipelines" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "flow_json" JSONB NOT NULL,

    CONSTRAINT "pipelines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pipelines_account_id_idx" ON "pipelines"("account_id");
