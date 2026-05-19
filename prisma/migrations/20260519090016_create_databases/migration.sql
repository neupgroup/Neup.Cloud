-- CreateTable
CREATE TABLE "databases" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "connectionType" TEXT NOT NULL,
    "connectionStatus" TEXT NOT NULL DEFAULT 'connected',
    "credentails" TEXT NOT NULL,
    "authConfig" JSONB NOT NULL,
    "lastValidatedAt" TIMESTAMP(6),
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "databases_pkey" PRIMARY KEY ("id")
);
