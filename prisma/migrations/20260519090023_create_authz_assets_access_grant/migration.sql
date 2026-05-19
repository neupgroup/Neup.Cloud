-- CreateTable
CREATE TABLE "authz_assets_access_grant" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "portfolio_id" TEXT,
    "asset_type" TEXT,

    CONSTRAINT "authz_assets_access_grant_pkey" PRIMARY KEY ("id")
);
