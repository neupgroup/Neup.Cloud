-- CreateTable
CREATE TABLE "permit" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "portfolio_id" TEXT,
    "asset_type" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "permit_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "permit" ADD CONSTRAINT "permit_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
