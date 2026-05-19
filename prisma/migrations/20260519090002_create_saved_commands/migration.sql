-- CreateTable
CREATE TABLE "saved_commands" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "description" TEXT,
    "nextCommands" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "variables" JSONB,
    "createdAt" TIMESTAMP(6) NOT NULL,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "saved_commands_pkey" PRIMARY KEY ("id")
);
