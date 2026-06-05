import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ScrollText } from 'lucide-react';

import LogsAccordion from '@/app/(main)/intelligence/logs/logs-accordion';
import { PageTitle } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { getCurrentIntelligenceAccountId } from '@/core/ai/files/intelligence/account';
import { getPaginatedIntelligenceLogs, parseLogContext } from '@/core/ai/files/intelligence/store';

export const metadata: Metadata = {
  title: 'Intelligence Logs, Neup.Cloud',
};

export default async function IntelligenceLogsPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const page = Number(resolvedSearchParams?.page || '1');
  const {
    logs,
    currentPage,
    totalPages,
  } = await getPaginatedIntelligenceLogs(
    await getCurrentIntelligenceAccountId(),
    Number.isFinite(page) ? page : 1,
    10
  );

  return (
    <div className="grid gap-8">
      <PageTitle
        title={
          <span className="flex items-center gap-3">
            <ScrollText className="h-8 w-8 text-primary" />
            Intelligence Logs
          </span>
        }
        description="Completed intelligence requests with compact summaries and expandable details."
      />

      {logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No intelligence logs yet. A log is written after a model call completes and usage is known.
        </p>
      ) : (
        <LogsAccordion
          logs={logs.map((log) => {
            const parsedContext = parseLogContext(log.context);

            return {
              id: log.id,
              accountId: String(log.account_id ?? log.access_id),
              accessId: log.access_id,
              model: log.modal || null,
              currency: log.currency || parsedContext.currency,
              cost: log.cost ?? null,
              inputTokens: log.inputTokens ?? null,
              outputTokens: log.outputTokens ?? null,
              query: (parsedContext.query || log.query || '').trim(),
              guider: parsedContext.guider.trim(),
              context: parsedContext.displayContext.trim(),
              response: (log.response || '').trim(),
            };
          })}
        />
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          {currentPage > 1 ? (
            <Button variant="outline" asChild>
              <Link href={`/intelligence/logs?page=${currentPage - 1}`}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Previous
              </Link>
            </Button>
          ) : (
            <Button variant="outline" disabled>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Previous
            </Button>
          )}
          <p className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </p>
          {currentPage < totalPages ? (
            <Button variant="outline" asChild>
              <Link href={`/intelligence/logs?page=${currentPage + 1}`}>
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" disabled>
              Next
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
