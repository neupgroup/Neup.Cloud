-- CreateTable
CREATE TABLE "environment_variables" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "selectedTargets" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isConfidential" BOOLEAN NOT NULL,
    "protectValue" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "environment_variables_pkey" PRIMARY KEY ("id")
);
