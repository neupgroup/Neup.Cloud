-- CreateTable
CREATE TABLE "authz_capability" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scope" TEXT,

    CONSTRAINT "authz_capability_pkey" PRIMARY KEY ("id")
);
