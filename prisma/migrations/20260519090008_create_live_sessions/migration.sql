-- CreateTable
CREATE TABLE "live_sessions" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL,
    "cwd" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "history" JSONB NOT NULL,
    "serverLogId" TEXT,
    "serverId" TEXT,

    CONSTRAINT "live_sessions_pkey" PRIMARY KEY ("id")
);
