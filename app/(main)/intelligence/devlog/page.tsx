import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, BugPlay } from 'lucide-react';

import { PageTitle } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { getCurrentIntelligenceAccountId } from '@/core/ai/files/intelligence/account';
import { getPaginatedIntelligenceDevLogs } from '@/core/ai/files/intelligence/store';

export const metadata: Metadata = {
  title: 'Intelligence Devlog, Neup.Cloud',
};

function formatJson(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default async function IntelligenceDevlogPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const page = Number(resolvedSearchParams?.page || '1');
  const { logs, currentPage, totalPages } = await getPaginatedIntelligenceDevLogs(
    await getCurrentIntelligenceAccountId(),
    Number.isFinite(page) ? page : 1,
    10
  );

  return (
    <div className="grid gap-8">
      <PageTitle
        title={
          <span className="flex items-center gap-3">
            <BugPlay className="h-8 w-8 text-primary" />
            Intelligence Devlog
          </span>
        }
        description="Full request and error audit trail for intelligence requests when dev mode is enabled."
      />

      <Card className="border-primary/15 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardHeader>
          <CardTitle className="font-headline">Audit feed</CardTitle>
          <CardDescription>
            Every logged request, failed response, and invalid request tied to this account appears here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No devlog entries yet.</p>
          ) : (
            <Accordion type="single" collapsible className="w-full space-y-4">
              {logs.map((log) => (
                <AccordionItem key={log.id} value={String(log.id)} className="border-0">
                  <Card className="overflow-hidden border border-border/70 bg-card py-2 transition-colors duration-200 hover:border-primary/30">
                    <AccordionTrigger className="px-5 py-4 hover:no-underline">
                      <div className="grid w-full gap-3 text-left">
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <span><span className="font-medium text-foreground">request_id:</span> {log.request_id}</span>
                          <span><span className="font-medium text-foreground">method:</span> {log.request_method}</span>
                          <span><span className="font-medium text-foreground">status:</span> {log.response_status ?? 'pending'}</span>
                          {log.account_id && <span><span className="font-medium text-foreground">account_id:</span> {log.account_id}</span>}
                          {log.access_id && <span><span className="font-medium text-foreground">access_id:</span> {log.access_id}</span>}
                        </div>
                        <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-3 text-sm whitespace-pre-wrap text-muted-foreground">
                          {log.request_url}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="border-t border-border/70 px-5 pb-5 pt-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Headers</p>
                          <pre className="overflow-x-auto rounded-lg border border-border/60 bg-muted/30 p-3 text-xs whitespace-pre-wrap">
                            {formatJson(log.request_headers)}
                          </pre>
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Query</p>
                          <pre className="overflow-x-auto rounded-lg border border-border/60 bg-muted/30 p-3 text-xs whitespace-pre-wrap">
                            {formatJson(log.request_query)}
                          </pre>
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Body</p>
                          <pre className="overflow-x-auto rounded-lg border border-border/60 bg-muted/30 p-3 text-xs whitespace-pre-wrap">
                            {formatJson(log.request_body) || 'No request body'}
                          </pre>
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Context</p>
                          <pre className="overflow-x-auto rounded-lg border border-border/60 bg-muted/30 p-3 text-xs whitespace-pre-wrap">
                            {formatJson(log.request_context) || 'No request context'}
                          </pre>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <p className="text-sm font-medium">Response / Error</p>
                          <pre className="overflow-x-auto rounded-lg border border-border/60 bg-muted/30 p-3 text-xs whitespace-pre-wrap">
                            {formatJson(log.response_body) ||
                              log.error_message ||
                              'No response recorded'}
                          </pre>
                        </div>
                        {log.error_stack && (
                          <div className="space-y-2 md:col-span-2">
                            <p className="text-sm font-medium">Stack</p>
                            <pre className="overflow-x-auto rounded-lg border border-border/60 bg-muted/30 p-3 text-xs whitespace-pre-wrap">
                              {log.error_stack}
                            </pre>
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </Card>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          {currentPage > 1 ? (
            <Button variant="outline" asChild>
              <Link href={`/intelligence/devlog?page=${currentPage - 1}`}>
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
              <Link href={`/intelligence/devlog?page=${currentPage + 1}`}>
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
