-- CreateTable
CREATE TABLE "pipeline_logs" (
    "id" TEXT NOT NULL,
    "pipeline_id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(6) NOT NULL,
    "log_by" TEXT NOT NULL,
    "details" TEXT NOT NULL,

    CONSTRAINT "pipeline_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pipeline_logs_pipeline_id_timestamp_idx" ON "pipeline_logs"("pipeline_id", "timestamp");
