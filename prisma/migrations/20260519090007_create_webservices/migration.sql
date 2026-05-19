-- CreateTable
CREATE TABLE "webservices" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "type" TEXT NOT NULL,
    "created_on" TIMESTAMP(6) NOT NULL,
    "updated_on" TIMESTAMP(6),
    "created_by" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "serverId" TEXT,
    "serverName" TEXT,

    CONSTRAINT "webservices_pkey" PRIMARY KEY ("id")
);
