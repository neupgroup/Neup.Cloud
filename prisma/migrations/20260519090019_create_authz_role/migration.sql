-- CreateTable
CREATE TABLE "authz_role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scope" TEXT,

    CONSTRAINT "authz_role_pkey" PRIMARY KEY ("id")
);
