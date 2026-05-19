-- CreateTable
CREATE TABLE "authz_role_capability" (
    "id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "capability_id" TEXT NOT NULL,
    "scope" TEXT,
    "denormalized_capability" JSONB,
    "role_name" TEXT,

    CONSTRAINT "authz_role_capability_pkey" PRIMARY KEY ("id")
);
