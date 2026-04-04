'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Server, Loader2, Play, Search, ChevronRight, CheckCircle2, XCircle, Clock } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getServers } from '../servers/actions';
import { getSavedCommands, executeSavedCommand } from './actions';
import { getServerLogs } from '../servers/[id]/actions';
import { runCustomCommandOnServer } from '../servers/[id]/actions';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '../../hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { type SavedCommand } from './types';
import { cn } from '@/lib/utils';
import { differenceInDays, differenceInHours, format, formatDistanceToNow } from 'date-fns';

type ServerType = {
  id: string;
  name: string;
  type: string;
};

type CommandHistoryItem = {
  id: string;
  command: string;
  commandName?: string;
  output?: string;
  status: 'Success' | 'Error' | 'pending';
  runAt: string;
};

type MergedCommandItem = {
  id: string;
  name: string;
  description?: string;
  commandText?: string;
};

const PAGE_SIZE = 10;

const LogStatusBadge = ({ status }: { status: CommandHistoryItem['status'] }) => {
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
        Failed
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-white bg-blue-600 px-2 py-0.5 rounded-full text-[10px] font-semibold w-fit border border-blue-700 shadow-sm">
      <Clock className="w-3 h-3" />
      Running
    </div>
  );
};

function LoadingSkeleton() {
  return (
    <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm">
      {[...Array(9)].map((_, i) => (
        <div
          key={i}
          className={cn('p-4 min-w-0 w-full', i !== 8 && 'border-b border-border')}
        >
          <div className="space-y-3">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      ))}
    </Card>
  );
}

function CommandsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [servers, setServers] = useState<ServerType[]>([]);
  const [savedCommands, setSavedCommands] = useState<SavedCommand[]>([]);
  const [historyLogs, setHistoryLogs] = useState<CommandHistoryItem[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isRunDialogOpen, setIsRunDialogOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const [selectedServer, setSelectedServer] = useState<string>('');
  const [commandToRun, setCommandToRun] = useState<SavedCommand | null>(null);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('query') || '');
  const [runtimeVariableValues, setRuntimeVariableValues] = useState<Record<string, string>>({});
  const [customCommand, setCustomCommand] = useState<string>('');
  const [isRunningCustom, setIsRunningCustom] = useState(false);

  useEffect(() => {
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
      return undefined;
    };

    const serverIdCookie = getCookie('selected_server');
    if (serverIdCookie) {
      setSelectedServer(serverIdCookie);
    }
  }, []);

  useEffect(() => {
    const query = searchParams.get('query');
    if (query !== null && query !== searchQuery) {
      setSearchQuery(query);
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const parsePage = (value: string | null) => {
    const parsed = Number.parseInt(value || '1', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  };

  const commandPage = parsePage(searchParams.get('commandPage'));
  const historyPage = parsePage(searchParams.get('historyPage'));

  const updateUrlParams = (
    updates: { query?: string; commandPage?: number; historyPage?: number },
    mode: 'push' | 'replace' = 'replace'
  ) => {
    const params = new URLSearchParams(searchParams.toString());

    if (updates.query !== undefined) {
      if (updates.query) {
        params.set('query', updates.query);
      } else {
        params.delete('query');
      }
    }

    if (updates.commandPage !== undefined) {
      if (updates.commandPage > 1) {
        params.set('commandPage', updates.commandPage.toString());
      } else {
        params.delete('commandPage');
      }
    }

    if (updates.historyPage !== undefined) {
      if (updates.historyPage > 1) {
        params.set('historyPage', updates.historyPage.toString());
      } else {
        params.delete('historyPage');
      }
    }

    const queryString = params.toString();
    const nextUrl = queryString ? `?${queryString}` : '?';
    if (mode === 'push') {
      router.push(nextUrl, { scroll: false });
    } else {
      router.replace(nextUrl, { scroll: false });
    }
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    updateUrlParams({ query: val, commandPage: 1, historyPage: 1 }, 'replace');
  };

  const fetchAllData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [serverData, commandsData] = await Promise.all([
        getServers(),
        getSavedCommands(),
      ]);

      setServers(serverData as ServerType[]);
      setSavedCommands(commandsData as SavedCommand[]);
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch commands data.' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  useEffect(() => {
    const fetchHistoryLogs = async () => {
      if (!selectedServer) {
        setHistoryLogs([]);
        return;
      }

      setIsHistoryLoading(true);
      try {
        const logs = await getServerLogs(selectedServer);
        setHistoryLogs(logs as CommandHistoryItem[]);
      } catch {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to load command history preview.',
        });
      } finally {
        setIsHistoryLoading(false);
      }
    };

    fetchHistoryLogs();
  }, [selectedServer, toast]);

  const openRunDialog = (e: React.MouseEvent, command: SavedCommand) => {
    e.stopPropagation();
    setCommandToRun(command);
    setRuntimeVariableValues({});

    if (command.variables && command.variables.length > 0) {
      setIsRunDialogOpen(true);
      return;
    }

    if (!selectedServer) {
      setIsRunDialogOpen(true);
      return;
    }

    void handleRunCommandDirect(command, selectedServer, {});
  };

  const handleRunCommandDirect = async (
    command: SavedCommand,
    serverId: string,
    variables: Record<string, string>
  ) => {
    setIsRunning(true);
    try {
      await executeSavedCommand(serverId, command.id, variables);
      toast({
        title: 'Execution Started',
        description: `Running "${command.name}" on the selected server. Check history for output.`,
      });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Execution Failed', description: e.message });
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunCommand = async () => {
    if (!commandToRun || !selectedServer) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'You must select a command and a server.',
      });
      return;
    }

    setIsRunning(true);
    try {
      await executeSavedCommand(selectedServer, commandToRun.id, runtimeVariableValues);
      toast({
        title: 'Execution Started',
        description: `Running "${commandToRun.name}" on the selected server. Check history for output.`,
      });
      setIsRunDialogOpen(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Execution Failed', description: e.message });
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunCustomCommand = async () => {
    if (!customCommand.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please enter a command.' });
      return;
    }

    if (!selectedServer) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select a server first.' });
      return;
    }

    setIsRunningCustom(true);
    try {
      await runCustomCommandOnServer(selectedServer, customCommand);
      toast({ title: 'Command Executed', description: 'Custom command has been executed. Check history for output.' });
      setCustomCommand('');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Execution Failed', description: e.message });
    } finally {
      setIsRunningCustom(false);
    }
  };

  const mergedCommands: MergedCommandItem[] = savedCommands.map((cmd) => ({
      id: cmd.id,
      name: cmd.name,
      description: cmd.description,
      commandText: cmd.command,
    }));

  const filteredCommands = mergedCommands.filter((item) => {
    const q = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      (item.description || '').toLowerCase().includes(q) ||
      (item.commandText || '').toLowerCase().includes(q)
    );
  });

  const filteredHistory = historyLogs.filter((log) => {
    const q = searchQuery.toLowerCase();
    return (
      (log.commandName || '').toLowerCase().includes(q) ||
      log.command.toLowerCase().includes(q) ||
      (log.output || '').toLowerCase().includes(q)
    );
  });

  const commandTotalPages = Math.max(1, Math.ceil(filteredCommands.length / PAGE_SIZE));
  const historyTotalPages = Math.max(1, Math.ceil(filteredHistory.length / PAGE_SIZE));

  const currentCommandPage = Math.min(commandPage, commandTotalPages);
  const currentHistoryPage = Math.min(historyPage, historyTotalPages);

  const visibleCommands = filteredCommands.slice(
    (currentCommandPage - 1) * PAGE_SIZE,
    currentCommandPage * PAGE_SIZE
  );

  const visibleHistory = filteredHistory.slice(
    (currentHistoryPage - 1) * PAGE_SIZE,
    currentHistoryPage * PAGE_SIZE
  );

  const getCommandDisplayName = (script: string, commandName?: string) => {
    if (commandName) return commandName;

    const match = savedCommands.find((c) => c.command.trim() === script.trim());
    if (match) return match.name;

    const lines = script.trim().split('\n');
    if (lines.length > 1) return 'Custom Command';
    if ((lines[0] || '').length > 60) return 'Custom Command';

    return lines[0] || 'Custom Command';
  };

  const formatHistoryDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = differenceInHours(now, date);
    const diffDays = differenceInDays(now, date);

    if (diffHours < 24) {
      return `${formatDistanceToNow(date, { addSuffix: true })} by User`;
    }

    if (diffDays < 7) {
      return `${diffDays} days ago by User`;
    }

    if (date.getFullYear() === now.getFullYear()) {
      return `on ${format(date, 'MMMM d')} by User`;
    }

    return `on ${format(date, 'yyyy MMMM')} by User`;
  };

  const selectedServerName = servers.find((s) => s.id === selectedServer)?.name || 'Server';

  return (
    <div className="grid gap-6">
          <div
        className="cursor-pointer hover:opacity-80 transition-opacity"
        onClick={() => router.push('/servers')}
      >
        <h1 className="text-3xl font-bold font-headline tracking-tight">Commands</h1>
        <p className="text-muted-foreground">Create, run, and track commands for '<span className="font-semibold text-foreground">{selectedServerName}</span>'</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search commands..."
          value={searchQuery}
          onChange={(e) => {
            handleSearchChange(e.target.value);
          }}
          className="pl-9"
          autoFocus={!!searchQuery}
        />
      </div>

      {selectedServer && (
        <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="p-4 space-y-4">
            <Textarea
              placeholder="Enter your custom command."
              value={customCommand}
              onChange={(e) => setCustomCommand(e.target.value)}
              onKeyDown={(e) => {
                if (e.ctrlKey && e.key === 'Enter') {
                  void handleRunCustomCommand();
                }
              }}
              className="font-mono text-sm min-h-[100px]"
            />
            <div className="flex justify-start">
              <Button onClick={handleRunCustomCommand} disabled={isRunningCustom}>
                {isRunningCustom ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Executing...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Run Custom Command
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="mt-6">
        <h2 className="text-2xl font-bold font-headline tracking-tight">Run saved commands.</h2>
        <p className="text-muted-foreground">Run saved commands and commands set.</p>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <div className="grid gap-6">
          <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm">
            <div
              className={cn(
                'p-4 min-w-0 w-full transition-colors hover:bg-muted/50 group flex items-start gap-4 cursor-pointer border-b border-border'
              )}
              onClick={() => router.push('/commands/create?mode=command')}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between mb-0 h-8">
                  <h3 className="font-semibold leading-none tracking-tight truncate pr-4 text-foreground group-hover:underline decoration-muted-foreground/30 underline-offset-4">
                    Save a command.
                  </h3>
                  <div className="h-8 w-8 flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors">
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  Save your reusable command/s.
                </p>
              </div>
            </div>

            {visibleCommands.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground">
                <p>No commands found matching &quot;{searchQuery}&quot;</p>
              </div>
            ) : (
              visibleCommands.map((item, index) => {
                const sourceCommand = savedCommands.find((cmd) => cmd.id === item.id);
                const isLastVisible = index === visibleCommands.length - 1;
                const showRowBorder = !isLastVisible || currentCommandPage < commandTotalPages;

                return (
                  <div
                    key={item.id}
                    className={cn(
                      'p-4 min-w-0 w-full transition-colors hover:bg-muted/50 group flex items-start gap-4 cursor-pointer',
                      showRowBorder && 'border-b border-border'
                    )}
                    onClick={() => router.push(`/commands/${item.id}`)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold leading-none tracking-tight truncate pr-4 text-foreground group-hover:underline decoration-muted-foreground/30 underline-offset-4">
                          {item.name}
                        </h3>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-background/80"
                          onClick={(e) => openRunDialog(e, sourceCommand || savedCommands[0])}
                          disabled={isRunning}
                          title="Run Command"
                        >
                          {isRunning ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                      </div>

                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {item.description || <span className="italic">No description provided</span>}
                      </p>
                    </div>
                  </div>
                );
              })
            )}

          </Card>

          <div className="flex justify-start gap-2">
            {currentCommandPage > 1 && (
              <Button
                variant="outline"
                onClick={() => updateUrlParams({ commandPage: currentCommandPage - 1 }, 'push')}
              >
                Previous
              </Button>
            )}
            {commandTotalPages > currentCommandPage && (
              <Button
                variant="outline"
                onClick={() => updateUrlParams({ commandPage: currentCommandPage + 1 }, 'push')}
              >
                Next
              </Button>
            )}
          </div>

          <div className="mt-6">
            <h2 className="text-2xl font-bold font-headline tracking-tight">Command History</h2>
            <p className="text-muted-foreground">Your recent command executions.</p>
          </div>

          {isHistoryLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, index) => (
                <div key={index} className="flex flex-col gap-2 rounded-lg border p-4">
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
          ) : searchQuery && filteredHistory.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              <p>No history found matching &quot;{searchQuery}&quot;</p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground rounded-lg border bg-card">
              <p className="mb-2 text-base font-medium text-foreground">No History Yet</p>
              <p className="text-sm">Commands run on this server will appear here.</p>
            </div>
          ) : (
            <Accordion type="single" collapsible className="w-full space-y-4">
              {visibleHistory.map((log) => (
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
                          <div className="font-semibold text-base text-foreground tracking-tight">
                            {getCommandDisplayName(log.command, log.commandName)}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <LogStatusBadge status={log.status} />
                            <span className="text-xs text-muted-foreground">{formatHistoryDate(log.runAt)}</span>
                          </div>
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
                          <div className="bg-zinc-950 text-zinc-50 p-4 rounded-lg font-mono text-sm border border-zinc-800/50 whitespace-pre-wrap break-all overflow-wrap-anywhere shadow-inner">
                            {log.output || <span className="text-zinc-500 italic">No output recorded.</span>}
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              router.push('/commands/history');
                            }}
                          >
                            Open full history
                          </Button>
                        </div>
                      </div>
                    </AccordionContent>
                  </Card>
                </AccordionItem>
              ))}
            </Accordion>
          )}

          <div className="flex justify-start gap-2">
            {currentHistoryPage > 1 && (
              <Button
                variant="outline"
                onClick={() => updateUrlParams({ historyPage: currentHistoryPage - 1 }, 'push')}
              >
                Previous
              </Button>
            )}
            {historyTotalPages > currentHistoryPage && (
              <Button
                variant="outline"
                onClick={() => updateUrlParams({ historyPage: currentHistoryPage + 1 }, 'push')}
              >
                Next
              </Button>
            )}
          </div>
        </div>
      )}

      <Dialog open={isRunDialogOpen} onOpenChange={setIsRunDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run Command: {commandToRun?.name}</DialogTitle>
            <DialogDescription>
              Select a server and provide values for any variables to execute this command.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="text-sm font-mono bg-muted p-3 rounded-md border whitespace-pre-wrap">
              {commandToRun?.command}
            </div>

            {commandToRun?.variables && commandToRun.variables.length > 0 && (
              <div className="space-y-4">
                {commandToRun.variables.map((variable) => (
                  <div key={variable.name} className="grid gap-2">
                    <Label htmlFor={`runtime-var-${variable.name}`}>{variable.title}</Label>
                    {variable.description && (
                      <p className="text-xs text-muted-foreground">{variable.description}</p>
                    )}
                    <Input
                      id={`runtime-var-${variable.name}`}
                      value={runtimeVariableValues[variable.name] || ''}
                      onChange={(e) =>
                        setRuntimeVariableValues((prev) => ({
                          ...prev,
                          [variable.name]: e.target.value,
                        }))
                      }
                      placeholder={variable.hint}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="server-select">Server</Label>
              <Select onValueChange={setSelectedServer} value={selectedServer}>
                <SelectTrigger id="server-select">
                  <SelectValue placeholder="Select a server" />
                </SelectTrigger>
                <SelectContent>
                  {servers.map((server) => (
                    <SelectItem key={server.id} value={server.id}>
                      <div className="flex items-center gap-2">
                        <Server className="h-4 w-4" />
                        {server.name} ({server.type})
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button onClick={handleRunCommand} disabled={!selectedServer || isRunning}>
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Executing...
                </>
              ) : (
                'Run on Server'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CommandsPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <CommandsContent />
    </Suspense>
  );
}
