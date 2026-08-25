-- DropTable
DROP TABLE "authz_account_access_grant";

-- DropTable
DROP TABLE "authz_assets_access_grant";

-- CreateTable
CREATE TABLE "authz_access" (
    "id" TEXT NOT NULL,
    "to_account_id" TEXT NOT NULL,
    "for_server_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "more_details" JSONB NOT NULL,

    CONSTRAINT "authz_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "authz_access_to_account_id_idx" ON "authz_access"("to_account_id");

-- CreateIndex
CREATE INDEX "authz_access_for_server_id_idx" ON "authz_access"("for_server_id");

-- CreateIndex
CREATE INDEX "authz_access_role_id_idx" ON "authz_access"("role_id");

-- AddForeignKey
ALTER TABLE "authz_access" ADD CONSTRAINT "authz_access_to_account_id_fkey" FOREIGN KEY ("to_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authz_access" ADD CONSTRAINT "authz_access_for_server_id_fkey" FOREIGN KEY ("for_server_id") REFERENCES "servers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authz_access" ADD CONSTRAINT "authz_access_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "authz_role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
