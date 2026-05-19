-- CreateTable
CREATE TABLE "server_logs" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "commandName" TEXT,
    "output" TEXT,
    "status" TEXT NOT NULL,
    "runAt" TIMESTAMP(6) NOT NULL,
    "source" TEXT,
    "accountId" TEXT,

    CONSTRAINT "server_logs_pkey" PRIMARY KEY ("id")
);
