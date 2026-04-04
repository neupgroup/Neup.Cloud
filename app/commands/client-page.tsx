'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Server, Loader2, Play, Search, ChevronRight } from 'lucide-react';
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

  const fallbackHistory = [
    'Command History Log 1',
    'Command History Log 2',
    'Command History Log 3',
  ];

  const formatHistoryTitle = (log: CommandHistoryItem) => {
    if (log.commandName) return log.commandName;
    const commandLine = log.command.split('\n')[0] || 'Custom Command';
    return commandLine.length > 60 ? `${commandLine.slice(0, 57)}...` : commandLine;
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

          <div className="flex justify-end gap-2">
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

          <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm">
            {isHistoryLoading ? (
              <div className="p-4 space-y-3">
                {[...Array(3)].map((_, index) => (
                  <Skeleton key={index} className="h-10 w-full" />
                ))}
              </div>
            ) : searchQuery && filteredHistory.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground">
                <p>No history found matching &quot;{searchQuery}&quot;</p>
              </div>
            ) : filteredHistory.length === 0 ? (
              fallbackHistory.map((title, index) => (
                <div
                  key={title}
                  className={cn(
                    'p-4 min-w-0 w-full transition-colors hover:bg-muted/50 group flex items-start gap-4 cursor-pointer',
                    index !== fallbackHistory.length - 1 && 'border-b border-border'
                  )}
                  onClick={() => router.push('/commands/history')}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between mb-0 h-8">
                      <h3 className="font-semibold leading-none tracking-tight truncate pr-4 text-foreground group-hover:underline decoration-muted-foreground/30 underline-offset-4">
                        {title}
                      </h3>
                      <div className="h-8 w-8 flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors">
                        <ChevronRight className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              visibleHistory.map((log, index) => {
                const isLastVisible = index === visibleHistory.length - 1;
                const showRowBorder = !isLastVisible || currentHistoryPage < historyTotalPages;

                return (
                  <div
                    key={log.id}
                    className={cn(
                      'p-4 min-w-0 w-full transition-colors hover:bg-muted/50 group flex items-start gap-4 cursor-pointer',
                      showRowBorder && 'border-b border-border'
                    )}
                    onClick={() => router.push('/commands/history')}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold leading-none tracking-tight truncate pr-4 text-foreground group-hover:underline decoration-muted-foreground/30 underline-offset-4">
                          {formatHistoryTitle(log)}
                        </h3>
                        <div className="h-8 w-8 flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors">
                          <ChevronRight className="h-4 w-4" />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(log.runAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </Card>

          <div className="flex justify-end gap-2">
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
