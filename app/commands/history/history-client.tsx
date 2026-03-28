
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, CheckCircle2, XCircle, Clock, ChevronRight } from 'lucide-react';
import { format, formatDistanceToNow, differenceInHours, differenceInDays, getYear, isSameYear } from 'date-fns';
import { useToast } from '../../../hooks/use-toast';
import { getServerLogs } from '../../servers/[id]/actions';
import { getSavedCommands } from '../actions';
import { SavedCommand } from '../types';
import { PageTitleWithComponent } from '@/components/page-header';
import { cn } from '@/lib/utils';

import type { ServerLog } from './page';

const LOGS_PER_PAGE = 10;

const LogStatusBadge = ({ status }: { status: ServerLog['status'] }) => {
  if (status === 'Success') {
    return (
      <div className="flex items-center gap-1.5 text-white bg-green-600 px-2 py-0.5 rounded-full text-[10px] font-semibold w-fit border border-green-700 shadow-sm">
        <CheckCircle2 className="w-3 h-3" />
        Success
      </div>
    )
  }
  if (status === 'Error') {
    return (
      <div className="flex items-center gap-1.5 text-white bg-red-600 px-2 py-0.5 rounded-full text-[10px] font-semibold w-fit border border-red-700 shadow-sm">
        <XCircle className="w-3 h-3" />
        Failed
      </div>
    )
  }
  // Pending or Running
  return (
    <div className="flex items-center gap-1.5 text-white bg-blue-600 px-2 py-0.5 rounded-full text-[10px] font-semibold w-fit border border-blue-700 shadow-sm">
      <Clock className="w-3 h-3" />
      Running
    </div>
  )
};

export function HistoryClient({ initialLogs, serverId, serverName }: { initialLogs: ServerLog[]; serverId: string; serverName?: string }) {
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [logs, setLogs] = useState(initialLogs);
  const [savedCommands, setSavedCommands] = useState<SavedCommand[]>([]);
  const [isLoading, setIsLoading] = useState(false); // Changed to false as initialLogs are provided

  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  useEffect(() => {
    if (!serverId) return;

    const refreshLogs = async () => {
      try {
        const newLogs = await getServerLogs(serverId) as ServerLog[];
        setLogs(newLogs);
      } catch (error) {
        console.error('Error refreshing logs:', error);
      }
    };

    void refreshLogs();
    const interval = window.setInterval(refreshLogs, 10000);

    return () => window.clearInterval(interval);
  }, [serverId]);

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(name, value);
      return params.toString();
    },
    [searchParams]
  );

  const handlePageChange = (newPage: number) => {
    router.push(pathname + '?' + createQueryString('page', newPage.toString()));
  }

  // Fetch Saved Commands for name mapping
  useEffect(() => {
    async function fetchData() {
      try {
        const commands = await getSavedCommands();
        setSavedCommands(commands as SavedCommand[]);
      } catch (e) {
        console.error("Failed to fetch saved commands for history mapping", e);
      }
    }
    fetchData();
  }, []);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const newLogs = await getServerLogs(serverId) as ServerLog[];
      setLogs(newLogs);
      toast({ title: 'Logs refreshed successfully.' })
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to refresh server logs.' });
    } finally {
      setIsLoading(false);
    }
  }, [serverId, toast]);

  const getCommandDisplayName = (script: string) => {
    // Exact match check
    const match = savedCommands.find(c => c.command.trim() === script.trim());
    if (match) return match.name;

    // Use custom logic
    const lines = script.trim().split('\n');
    if (lines.length > 1) return "Custom Command"; // Multi-line is likely custom
    if (lines[0].length > 60) return "Custom Command"; // Long single line likely custom

    return lines[0]; // Short single line, show it.
  }

  const formatLogDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = differenceInHours(now, date);
    const diffDays = differenceInDays(now, date);
    const currentYear = new Date().getFullYear();

    // 25 minutes ago by [UserId] upto 1 hours
    // 3 hours ago by [UserId] upto 24 hours
    if (diffHours < 24) {
      return `${formatDistanceToNow(date, { addSuffix: true })} by User`;
    }

    // 2 days ago by [UserId] upto 7 days
    if (diffDays < 7) {
      return `${diffDays} days ago by User`;
    }

    if (date.getFullYear() === currentYear) {
      // Same year
      return `on ${format(date, 'MMMM d')} by User`;
    } else {
      // Different year
      return `on ${format(date, 'yyyy MMMM')} by User`;
    }
  }

  const totalLogPages = Math.ceil(logs.length / LOGS_PER_PAGE);
  const displayedLogs = logs.slice(
    (currentPage - 1) * LOGS_PER_PAGE,
    currentPage * LOGS_PER_PAGE
  );

  return (
    <div className="space-y-6">
      {/* Page Title with Reload Action */}
      <PageTitleWithComponent
        title="Command History"
        description="Review past command executions"
        serverName={serverName}
        actionComponent={
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchLogs}
            disabled={isLoading}
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            title="Reload Logs"
          >
            <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        }
      />


      {/* Content */}
      {isLoading && logs.length === 0 ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-20 rounded-full" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
                <Skeleton className="h-4 w-4 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : displayedLogs.length > 0 ? (
        <div className="grid gap-4">
          <Accordion type="single" collapsible className="w-full space-y-4">
            {displayedLogs.map((log) => (
              <AccordionItem key={log.id} value={log.id} className="border-0">
                <Card
                  className={cn(
                    "overflow-hidden bg-card text-card-foreground shadow-sm transition-all duration-200 border border-border group",
                    log.status === 'Success' && "hover:border-green-500/50 hover:bg-green-50/5 dark:hover:bg-green-950/20",
                    log.status === 'Error' && "hover:border-red-500/50 hover:bg-red-50/5 dark:hover:bg-red-950/20",
                    log.status === 'pending' && "hover:border-blue-500/50 hover:bg-blue-50/5 dark:hover:bg-blue-950/20"
                  )}
                >
                  <AccordionTrigger className="px-4 py-3 hover:no-underline w-full [&[data-state=open]>div>div>svg]:rotate-90">
                    <div className="flex items-start justify-between w-full gap-4">
                      <div className="flex flex-col items-start gap-1 w-full">
                        {/* Command Name */}
                        <div className="font-semibold text-base text-foreground tracking-tight">
                          {log.commandName || getCommandDisplayName(log.command)}
                        </div>

                        {/* Status + Meta Combined */}
                        <div className="flex items-center gap-2 mt-1">
                          <LogStatusBadge status={log.status} />
                          <span className="text-xs text-muted-foreground">{formatLogDate(log.runAt)}</span>
                        </div>
                      </div>

                      {/* Chevron - Custom Position/Animation */}
                      <div className="text-muted-foreground/50 group-hover:text-foreground transition-colors pt-1">
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-6 pt-0 border-t border-border/50 bg-muted/5">
                    <div className="space-y-6 pt-6 animate-in slide-in-from-top-2 duration-200">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Command</h4>
                        </div>
                        <div className="bg-muted/50 p-4 rounded-lg font-mono text-sm border text-foreground whitespace-pre-wrap break-all shadow-sm">
                          {log.command}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Output</h4>
                        </div>
                        {/* Modified: Removed max-h and overflow-y-auto to allow full expansion based on content */}
                        <div className="bg-zinc-950 text-zinc-50 p-4 rounded-lg font-mono text-sm border border-zinc-800/50 whitespace-pre-wrap break-all overflow-wrap-anywhere shadow-inner">
                          {log.output || <span className="text-zinc-500 italic">No output recorded.</span>}
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </Card>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      ) : (
        <Card className="p-16 text-center text-muted-foreground flex flex-col items-center justify-center border-dashed border-2 bg-muted/5">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <Clock className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="mb-2 text-lg font-medium text-foreground">No History Yet</p>
          <p className="mb-6 text-sm max-w-sm mx-auto">Commands run on this server will appear here. Start by running a command.</p>
          <Button asChild>
            <a href="/commands">Explore Commands</a>
          </Button>
        </Card>
      )}

      {totalLogPages > 1 && (
        <div className="flex justify-center gap-2 pt-6">
          <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => handlePageChange(currentPage - 1)}>
            Previous
          </Button>
          <div className="flex items-center px-4 text-sm font-medium text-muted-foreground">
            Page {currentPage} of {totalLogPages}
          </div>
          <Button variant="outline" size="sm" disabled={currentPage >= totalLogPages} onClick={() => handlePageChange(currentPage + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
