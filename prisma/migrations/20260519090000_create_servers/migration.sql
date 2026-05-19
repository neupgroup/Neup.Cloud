-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "servers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "ram" TEXT,
    "storage" TEXT,
    "moreDetails" TEXT,
    "publicIp" TEXT NOT NULL,
    "privateIp" TEXT,
    "privateKey" TEXT,
    "proxyHandler" TEXT,
    "loadBalancer" TEXT,
    "createdAt" TIMESTAMP(6) NOT NULL,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "servers_pkey" PRIMARY KEY ("id")
);
