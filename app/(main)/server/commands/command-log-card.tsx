'use client';

import Link from 'next/link';
import { CheckCircle2, XCircle, Clock, ChevronRight, ArrowUpRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/core/utils';
import { differenceInDays, differenceInHours, format, formatDistanceToNow } from 'date-fns';
import { useEffect, useState } from 'react';
import { getAccountName } from '@/services/account';

export type CommandLogItem = {
  id: string;
  command: string;
  commandName?: string;
  source?: string | null;
  output?: string;
  status: 'Success' | 'Error' | 'pending';
  runAt: string;
};

function LogStatusBadge({ status }: { status: CommandLogItem['status'] }) {
  if (status === 'Success') {
    return (
      <div className="flex items-center gap-1.5 text-white bg-green-600 px-2 py-0.5 rounded-full text-[10px] font-semibold w-fit border border-green-700 shadow-sm">
        <CheckCircle2 className="w-3 h-3" />
        Success
      </div>
    );
  }
  if (status === 'Error') {
    return (
      <div className="flex items-center gap-1.5 text-white bg-red-600 px-2 py-0.5 rounded-full text-[10px] font-semibold w-fit border border-red-700 shadow-sm">
        <XCircle className="w-3 h-3" />
        Error
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-white bg-blue-600 px-2 py-0.5 rounded-full text-[10px] font-semibold w-fit border border-blue-700 shadow-sm">
      <Clock className="w-3 h-3" />
      Pending
    </div>
  );
}

function formatDate(runAt: string) {
  const date = new Date(runAt);
  const now = new Date();
  if (differenceInHours(now, date) < 24) return formatDistanceToNow(date, { addSuffix: true });
  if (differenceInDays(now, date) < 7) return format(date, 'EEE, MMM d HH:mm');
  return format(date, 'MMM d, yyyy HH:mm');
}

function getSourceInfo(log: CommandLogItem): { label: string; href: string } | null {
  const src = log.source;
  if (!src) return null;
  if (src.startsWith('application:')) {
    const id = src.replace('application:', '');
    // commandName is "AppName cmdName" — strip the last word to get just the app name
    const parts = log.commandName?.trim().split(' ') ?? [];
    const appName = parts.length > 1 ? parts.slice(0, -1).join(' ') : (log.commandName || id);
    return { label: appName, href: `/server/applications/${id}` };
  }
  if (src === 'commands:custom') return { label: 'Commands', href: '/server/commands' };
  if (src.startsWith('webservices')) return { label: 'Webservices', href: '/server/webservices' };
  if (src.startsWith('requirement:')) return { label: 'System', href: '/server/system' };
  return null;
}

function getDisplayName(command: string, commandName?: string) {
  if (commandName) return commandName;
  if (command.length <= 60) return command;
  return command.slice(0, 60) + '…';
}

export function CommandLogCard({ log }: { log: CommandLogItem }) {
  const sourceInfo = getSourceInfo(log);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    getAccountName().then(setUserName);
  }, []);

  return (
    <AccordionItem key={log.id} value={log.id} className="border-0">
      <Card
        className={cn(
          'overflow-hidden bg-card text-card-foreground shadow-sm transition-all duration-200 border border-border group',
          log.status === 'Success' && 'hover:border-green-500/50 hover:bg-green-50/5 dark:hover:bg-green-950/20',
          log.status === 'Error' && 'hover:border-red-500/50 hover:bg-red-50/5 dark:hover:bg-red-950/20',
          log.status === 'pending' && 'hover:border-blue-500/50 hover:bg-blue-50/5 dark:hover:bg-blue-950/20'
        )}
      >
        <AccordionTrigger className="px-4 py-3 hover:no-underline w-full [&[data-state=open]>div>div>svg]:rotate-90">
          <div className="flex items-start justify-between w-full gap-4">
            <div className="flex flex-col items-start gap-1 w-full">
              <div className="font-semibold text-base text-foreground tracking-tight flex items-center gap-1.5">
                {getDisplayName(log.command, log.commandName)}
                {sourceInfo && (
                  <Link
                    href={sourceInfo.href}
                    onClick={(e) => e.stopPropagation()}
                    className="text-muted-foreground hover:text-primary transition-colors"
                    title={sourceInfo.label}
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <LogStatusBadge status={log.status} />
                <span className="text-xs text-muted-foreground">
                  {formatDate(log.runAt)}
                  {' '}by <span className="font-medium text-foreground">{userName ?? 'Unknown User'}</span>
                </span>
              </div>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-6 pb-6 pt-0 border-t border-border/50 bg-muted/5">
          <div className="space-y-6 pt-6 animate-in slide-in-from-top-2 duration-200">
            <div>
              <div className="bg-muted/50 p-4 rounded-lg font-mono text-sm border text-foreground whitespace-pre-wrap break-all shadow-sm">
                {log.command}
              </div>
            </div>
            <div>
              <div className="bg-zinc-950 text-zinc-50 p-4 rounded-lg font-mono text-sm border border-zinc-800/50 whitespace-pre-wrap break-all overflow-wrap-anywhere shadow-inner">
                {log.output || <span className="text-zinc-500 italic">No output recorded.</span>}
              </div>
            </div>
          </div>
        </AccordionContent>
      </Card>
    </AccordionItem>
  );
}

export function CommandLogList({ logs, showSourceLink = true }: { logs: CommandLogItem[]; showSourceLink?: boolean }) {
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    getAccountName().then(setUserName);
  }, []);

  return (
    <Card className="w-full overflow-hidden border-border">
      <Accordion type="single" collapsible className="w-full">
        {logs.map((log, i) => {
          const sourceInfo = getSourceInfo(log);
          const isLast = i === logs.length - 1;
          return (
            <AccordionItem key={log.id} value={log.id} className={cn('border-0', !isLast && 'border-b border-border')}>
              <AccordionTrigger className="px-4 py-4 hover:no-underline hover:bg-muted/40 transition-colors w-full [&>svg]:hidden [&[data-state=open]]:bg-muted/50 [&[data-state=open]]:border-b-0">
                <div className="flex items-center justify-between w-full gap-4 text-left">
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="font-semibold text-base text-foreground tracking-tight flex items-center gap-1.5">
                      {getDisplayName(log.command, log.commandName)}
                      {showSourceLink && sourceInfo && (
                        <Link
                          href={sourceInfo.href}
                          onClick={(e) => e.stopPropagation()}
                          className="text-muted-foreground hover:text-primary transition-colors"
                          title={sourceInfo.label}
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <LogStatusBadge status={log.status} />
                      <span className="text-xs text-muted-foreground">
                        {formatDate(log.runAt)}
                        {' '}by <span className="font-medium text-foreground">{userName ?? 'Unknown User'}</span>
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 [[data-state=open]_&]:rotate-90" />
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-0">
                <div className="px-4 pb-4 space-y-4 pt-4">
                  <div className="bg-muted/50 p-4 rounded-lg font-mono text-sm border text-foreground whitespace-pre-wrap break-all shadow-sm">
                    {log.command}
                  </div>
                  <div className="bg-zinc-950 text-zinc-50 p-4 rounded-lg font-mono text-sm border border-zinc-800/50 whitespace-pre-wrap break-all overflow-wrap-anywhere shadow-inner">
                    {log.output || <span className="text-zinc-500 italic">No output recorded.</span>}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </Card>
  );
}

export function CommandLogListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <Card className="w-full overflow-hidden border-border">
      <div className="w-full">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className={cn('px-4 py-4', index < rows - 1 && 'border-b border-border')}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-5 w-52" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-20 rounded-full" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
              <Skeleton className="h-4 w-4 rounded-full shrink-0" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
