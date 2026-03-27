import type { Metadata } from 'next';
import Link from 'next/link';
import { History, ReceiptText, ScrollText } from 'lucide-react';

import { PageTitle } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getCurrentIntelligenceAccountId } from '@/lib/intelligence/account';
import { getIntelligenceLogs, parseLogContext } from '@/lib/intelligence/store';

export const metadata: Metadata = {
  title: 'Intelligence Logs, Neup.Cloud',
};

export default async function IntelligenceLogsPage() {
  const logs = await getIntelligenceLogs(await getCurrentIntelligenceAccountId());

  return (
    <div className="grid gap-8">
      <PageTitle
        title={
          <span className="flex items-center gap-3">
            <ScrollText className="h-8 w-8 text-primary" />
            Intelligence Logs
          </span>
        }
        description="A placeholder area for request history, responses, model usage, and balance changes."
      />

      <Card className="border-primary/15 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardHeader className="space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <History className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-headline">
            Log history will appear here
          </CardTitle>
          <CardDescription className="max-w-2xl text-base">
            This page shows completed intelligence requests. Logs appear only after a response finishes and usage is known.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/intelligence/logs/recharge">Open Recharge</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/intelligence/access">Manage Access</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-headline">
            <ReceiptText className="h-5 w-5 text-primary" />
            Recent Logs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No intelligence logs yet. A log is written after a model call completes and usage is known.
            </p>
          ) : (
            <div className="grid gap-4">
              {logs.map((log) => {
                const parsedContext = parseLogContext(log.context);

                return (
                  <Card key={log.id} className="border-border/70">
                    <CardHeader className="gap-3">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-1">
                          <CardTitle className="font-headline">
                            {log.prompt_id}
                          </CardTitle>
                          <CardDescription>
                            Access ID: {log.access_id}
                          </CardDescription>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">Log {log.id}</Badge>
                          <Badge variant="outline">{log.modal || 'Unknown model'}</Badge>
                          {parsedContext.usageTokens !== null && (
                            <Badge variant="outline">Cost {parsedContext.usageTokens} tokens</Badge>
                          )}
                          {parsedContext.estimatedCost !== null && (
                            <Badge variant="outline">${parsedContext.estimatedCost}</Badge>
                          )}
                          {log.balance !== null && (
                            <Badge variant="outline">Balance {log.balance}</Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground">Query</p>
                        <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm whitespace-pre-wrap text-muted-foreground">
                          {log.query || 'No query stored'}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground">Response</p>
                        <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm whitespace-pre-wrap text-muted-foreground">
                          {log.response || 'No response stored'}
                        </div>
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <p className="text-sm font-medium text-foreground">Context</p>
                        <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm whitespace-pre-wrap text-muted-foreground">
                          {parsedContext.displayContext || 'No context stored'}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
