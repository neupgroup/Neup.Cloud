import { notFound } from 'next/navigation';
import { AlertTriangle, KeyRound } from 'lucide-react';
import { PageTitle } from '@/components/page-header';
import { getLoggerProjectRecord } from '@/services/logger/logger-service';
import { ProjectCredentialsFields } from './project-credentials-fields';

// Renders project identifiers and the environment values needed by logger clients.
export default async function LoggerProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ keyRotated?: string }>;
}) {
  const [{ id: projectId }, { keyRotated }] = await Promise.all([params, searchParams]);
  const project = await getLoggerProjectRecord(projectId);
  if (!project) notFound();

  const environmentValues = [
    `NEUP_LOGGER_PROJECT_ID=${JSON.stringify(project.id)}`,
    `NEUP_LOGGER_INGEST_KEY=${JSON.stringify(project.ingestKey)}`,
  ].join('\n');

  return (
    <div className="grid min-w-0 gap-10">
      <PageTitle title={project.name} description="Manage this logger project and its ingestion credentials." />

      {keyRotated === '1' ? (
        <div role="status" className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>The ingest key was rotated. Update the environment values in every application using this project.</p>
        </div>
      ) : null}
      <section className="grid min-w-0 gap-8">
        <div className="grid gap-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><KeyRound className="h-5 w-5" />Project credentials</h2>
          <p className="text-sm text-muted-foreground">Use these values in your application environment. The project ID and ingest key identify logging requests; keep the ingest key private.</p>
        </div>

        <ProjectCredentialsFields projectId={project.id} ingestKey={project.ingestKey} />

        <div className="grid min-w-0 gap-3 pt-8">
          <h2 className="font-semibold">Environment values</h2>
          <pre className="m-0 max-w-full overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-muted/40 p-4 font-mono text-xs">{environmentValues}</pre>
          <p className="text-xs text-muted-foreground">Add these entries to your server-side <code>.env</code> file. The ID is used publicly to identify the project; do not expose the ingest key in browser code.</p>
        </div>

      </section>
    </div>
  );
}
