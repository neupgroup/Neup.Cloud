import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Database, Workflow } from 'lucide-react';

import { PageTitle } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getCurrentIntelligenceAccountId } from '@/lib/intelligence/account';
import { getPipelinesByAccountId } from '@/services/pipelines/data';

export const metadata: Metadata = {
  title: 'Pipeline Instances | Neup.Cloud',
  description: 'Browse saved pipelines from the database.',
};

function getFlowStats(flowJson: unknown) {
  if (!flowJson || typeof flowJson !== 'object') {
    return { nodes: 0, edges: 0 };
  }

  const flow = flowJson as {
    nodes?: unknown[];
    edges?: unknown[];
  };

  return {
    nodes: Array.isArray(flow.nodes) ? flow.nodes.length : 0,
    edges: Array.isArray(flow.edges) ? flow.edges.length : 0,
  };
}

function normalizePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);

  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

export default async function PipelineInstancePage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string | string[] }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const pipelines = await getPipelinesByAccountId(await getCurrentIntelligenceAccountId());
  const page = normalizePage(resolvedSearchParams.page);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(pipelines.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const visiblePipelines = pipelines.slice(startIndex, startIndex + pageSize);

  return (
    <div className="grid gap-8">
      <PageTitle
        title={
          <span className="flex items-center gap-3">
            <Workflow className="h-8 w-8 text-primary" />
            Pipeline Instances
          </span>
        }
        description="Browse and open the pipelines that have been saved in the database."
      />

      {pipelines.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex min-h-[280px] flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <Database className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold tracking-tight">No saved pipelines yet</h2>
              <p className="max-w-2xl text-sm text-muted-foreground">
                This page shows the rows stored in the <code>pipelines</code> table. Save a pipeline into the database and it will appear here.
              </p>
            </div>
            <Button asChild>
              <Link href="/pipeline/editor">
                Open editor
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Showing {startIndex + 1}-{Math.min(startIndex + pageSize, pipelines.length)} of {pipelines.length}
            </span>
            <span>Page {currentPage} of {totalPages}</span>
          </div>

          {visiblePipelines.map((pipeline) => {
            const stats = getFlowStats(pipeline.flowJson);

            return (
              <Link
                key={pipeline.id}
                href={`/pipeline/editor?id=${encodeURIComponent(pipeline.id)}`}
                className="block h-full"
              >
                <Card className="transition-colors hover:border-primary/40 hover:bg-primary/5">
                  <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 space-y-1">
                          <CardTitle className="truncate font-headline text-xl">{pipeline.title}</CardTitle>
                          <CardDescription className="line-clamp-2">
                            {pipeline.description?.trim() || 'No description yet.'}
                          </CardDescription>
                        </div>
                        <Badge variant="outline" className="shrink-0">{stats.nodes} nodes</Badge>
                      </div>

                    </div>

                    <div className="flex items-center justify-between border-t border-border/60 pt-4 text-sm font-medium text-muted-foreground lg:w-[180px] lg:flex-none lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
                      <span>Open in editor</span>
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}

          {totalPages > 1 ? (
            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" asChild disabled={currentPage <= 1}>
                <Link
                  href={currentPage <= 1 ? '/pipeline/instance' : `/pipeline/instance?page=${currentPage - 1}`}
                  aria-disabled={currentPage <= 1}
                >
                  Previous
                </Link>
              </Button>

              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </div>

              <Button variant="outline" asChild disabled={currentPage >= totalPages}>
                <Link
                  href={currentPage >= totalPages ? `/pipeline/instance?page=${totalPages}` : `/pipeline/instance?page=${currentPage + 1}`}
                  aria-disabled={currentPage >= totalPages}
                >
                  Next
                </Link>
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
