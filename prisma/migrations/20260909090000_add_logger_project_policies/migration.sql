ALTER TABLE "projects"
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "ingestKey" TEXT,
  ADD COLUMN "allowLocalhostErrors" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "allowedErrorDomains" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "allowWithoutOrigin" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "errorsPerMinute" INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN "errorsPerTenMinutes" INTEGER NOT NULL DEFAULT 300;

UPDATE "projects" SET "slug" = lower(regexp_replace("name", '[^a-zA-Z0-9]+', '-', 'g')) WHERE "slug" IS NULL;
UPDATE "projects" SET "slug" = concat('project-', "id") WHERE "slug" IS NULL OR "slug" = '';
UPDATE "projects" SET "ingestKey" = concat('legacy-', "id") WHERE "ingestKey" IS NULL;

ALTER TABLE "projects" ALTER COLUMN "slug" SET NOT NULL, ALTER COLUMN "ingestKey" SET NOT NULL;
CREATE UNIQUE INDEX "projects_slug_key" ON "projects"("slug");
CREATE UNIQUE INDEX "projects_ingestKey_key" ON "projects"("ingestKey");
