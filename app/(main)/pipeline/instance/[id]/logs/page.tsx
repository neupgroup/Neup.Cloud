import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ScrollText } from 'lucide-react';

import { clearPipelineLogsAction } from '@/services/pipelines/pipelines-service';
import { PageTitle } from '@/components/page-header';
import { Badge } from '#/components/ui/badge';
import { Button } from '#/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card';
import { getCurrentIntelligenceAccountId } from '@/services/intelligence/account';
import {
  getPipelineById,
  getPipelineLogsByPipelineId,
  type StoredPipelineLog,
} from '@/services/pipelines/data';

export const metadata: Metadata = {
  title: 'Pipeline Logs | Neup.Cloud',
  description: 'Browse pipeline editor and execution logs.',
};

function formatLogTimestamp(value: string) {
  return new Date(value).toLocaleString();
}

export default async function PipelineInstanceLogsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const accountId = await getCurrentIntelligenceAccountId();
  const pipeline = await getPipelineById(id, accountId);

  if (!pipeline) {
    notFound();
  }

  const logs = await getPipelineLogsByPipelineId(pipeline.id, { limit: 200 });

  return (
    <div className="grid gap-8">
      <PageTitle
        title={
          <span className="flex items-center gap-3">
            <ScrollText className="h-8 w-8 text-primary" />
            {pipeline.title} Logs
          </span>
        }
        description="Database-backed pipeline logs for this saved instance."
      />

      <Card>
        <CardContent className="grid gap-3 p-4">
          {logs.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              No logs recorded for this pipeline yet.
            </div>
          ) : (
            logs.map((log: StoredPipelineLog) => (
              <Card key={log.id} className="transition-colors hover:border-primary/30">
                <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{log.logBy}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {formatLogTimestamp(log.timestamp)}
                      </span>
                    </div>
                    <div className="text-sm text-foreground">
                      {log.details}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <form
          action={async () => {
            'use server';
            await clearPipelineLogsAction({ pipelineId: pipeline.id });
          }}
        >
          <Button type="outlined" htmlType="submit">
            Clear logs
          </Button>
        </form>
      </div>
    </div>
  );
}
