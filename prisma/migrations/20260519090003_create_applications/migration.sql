-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "appIcon" TEXT,
    "location" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "repository" TEXT,
    "networkAccess" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "commands" JSONB,
    "information" JSONB,
    "owner" TEXT NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL,
    "updatedAt" TIMESTAMP(6) NOT NULL,
    "environments" JSONB,
    "files" JSONB,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);
