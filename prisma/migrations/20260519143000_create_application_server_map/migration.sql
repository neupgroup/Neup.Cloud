-- CreateEnum
CREATE TYPE "ApplicationServerMapStatus" AS ENUM ('stopped', 'started', 'inactive');

-- CreateTable
CREATE TABLE "application_server_map" (
    "id" TEXT NOT NULL,
    "server_id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "status" "ApplicationServerMapStatus" NOT NULL DEFAULT 'started',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "application_server_map_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "application_server_map_app_server_unique" ON "application_server_map"("application_id", "server_id");

-- CreateIndex
CREATE INDEX "application_server_map_application_id_idx" ON "application_server_map"("application_id");

-- CreateIndex
CREATE INDEX "application_server_map_server_id_idx" ON "application_server_map"("server_id");

-- AddForeignKey
ALTER TABLE "application_server_map" ADD CONSTRAINT "application_server_map_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_server_map" ADD CONSTRAINT "application_server_map_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
