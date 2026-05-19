-- CreateTable
CREATE TABLE "errors" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "timestamp" TIMESTAMP(6) NOT NULL,
    "stack" TEXT,

    CONSTRAINT "errors_pkey" PRIMARY KEY ("id")
);
