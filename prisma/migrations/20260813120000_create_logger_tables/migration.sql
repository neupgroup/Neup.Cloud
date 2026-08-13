CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdOn" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "projects_name_key" ON "projects"("name");

CREATE TABLE "loggerActivity" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "loggedOn" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "loggerActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "logger_activity_project_id_idx" ON "loggerActivity"("projectId");
CREATE INDEX "logger_activity_type_idx" ON "loggerActivity"("type");
CREATE INDEX "logger_activity_logged_on_idx" ON "loggerActivity"("loggedOn");

ALTER TABLE "loggerActivity"
ADD CONSTRAINT "loggerActivity_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "projects"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
