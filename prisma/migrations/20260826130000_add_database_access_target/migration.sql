-- AlterTable
ALTER TABLE "authz_access"
    ALTER COLUMN "for_server_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "authz_access"
    ADD COLUMN "database_id" TEXT;

-- CreateIndex
CREATE INDEX "authz_access_database_id_idx" ON "authz_access"("database_id");

-- AddForeignKey
ALTER TABLE "authz_access" ADD CONSTRAINT "authz_access_database_id_fkey" FOREIGN KEY ("database_id") REFERENCES "databases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddConstraint
ALTER TABLE "authz_access"
    ADD CONSTRAINT "authz_access_single_target_check"
    CHECK (("for_server_id" IS NOT NULL) <> ("database_id" IS NOT NULL));
