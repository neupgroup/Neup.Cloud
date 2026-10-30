DROP INDEX IF EXISTS "projects_slug_key";

ALTER TABLE "projects"
DROP COLUMN IF EXISTS "slug";
