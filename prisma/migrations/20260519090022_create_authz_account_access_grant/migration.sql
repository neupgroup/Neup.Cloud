-- CreateTable
CREATE TABLE "authz_account_access_grant" (
    "id" TEXT NOT NULL,
    "owner_account_id" TEXT NOT NULL,
    "target_account_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "portfolio_id" TEXT,

    CONSTRAINT "authz_account_access_grant_pkey" PRIMARY KEY ("id")
);
