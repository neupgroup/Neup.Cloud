/*
::neup.documentation::server-commands-continuity-page
::title Continuity Terminal Page

Continuity terminal interface backed by tmux sessions on the selected server.

::public

This page lists open continuity terminals on the selected server and opens a session when the URL contains `session` and `selectedServer`.

::public end

::private

The page keeps server selection in query state and polls tmux pane output for the active session.

::private end

::end
*/

'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Plus, RefreshCcw, Server, SquareTerminal, XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/core/hooks/use-toast';
import { withSelectedServerQuery } from '@/inapp/helpers/navigation';
import { useSelectedServerId } from '@/inapp/hooks/use-selected-server';
import { createContinuitySession, getContinuitySessionSnapshot, listContinuitySessions, sendContinuityCommand, terminateContinuitySession, type ContinuitySession, type ContinuitySessionSnapshot } from '@/services/server/continuity-service';
import { getServers } from '@/services/server/server-service';

type ServerOption = {
  id: string;
  name: string;
  publicIp?: string | null;
};

/*
::neup.documentation::server-commands-continuity-client
::private

Client implementation for the continuity page.

::private end
::end
*/

export default function ContinuityPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const selectedServerFromUrl = useSelectedServerId();
  const requestedSessionId = searchParams.get('session')?.trim() || '';

  const [servers, setServers] = useState<ServerOption[]>([]);
  const [sessions, setSessions] = useState<ContinuitySession[]>([]);
  const [snapshot, setSnapshot] = useState<ContinuitySessionSnapshot | null>(null);
  const [command, setCommand] = useState('');
  const [isLoadingServers, setIsLoadingServers] = useState(true);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [isCreatingSession, startCreatingSession] = useTransition();
  const [isSendingCommand, startSendingCommand] = useTransition();
  const [isEndingSession, startEndingSession] = useTransition();

  const terminalScrollRef = useRef<HTMLDivElement>(null);

  const selectedServerId = useMemo(() => {
    if (!selectedServerFromUrl) {
      return '';
    }

    return servers.find((server) => server.id === selectedServerFromUrl)?.id ?? selectedServerFromUrl;
  }, [selectedServerFromUrl, servers]);

  const selectedServer = useMemo(
    () => servers.find((server) => server.id === selectedServerId) ?? null,
    [servers, selectedServerId]
  );

  useEffect(() => {
    let cancelled = false;

    setIsLoadingServers(true);
    getServers()
      .then((result) => {
        if (cancelled) {
          return;
        }

        setServers(
          result.map((server) => ({
            id: server.id,
            name: server.name,
            publicIp: server.publicIp,
          }))
        );
      })
      .catch((error: Error) => {
        if (cancelled) {
          return;
        }

        setPageError(error.message || 'Failed to load servers.');
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingServers(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isLoadingServers || selectedServerId || servers.length === 0) {
      return;
    }

    router.replace(withSelectedServerQuery('/server/commands/continuity', servers[0].id), { scroll: false });
  }, [isLoadingServers, router, selectedServerId, servers]);

  useEffect(() => {
    if (!selectedServerId) {
      setSessions([]);
      setSnapshot(null);
      return;
    }

    let cancelled = false;

    const loadSessions = async (keepLoader = true) => {
      if (keepLoader) {
        setIsLoadingSessions(true);
      }

      try {
        const nextSessions = await listContinuitySessions(selectedServerId);
        if (cancelled) {
          return;
        }

        setSessions(nextSessions);
        setPageError(null);
      } catch (error: any) {
        if (cancelled) {
          return;
        }

        setPageError(error.message || 'Failed to load continuity sessions.');
      } finally {
        if (!cancelled && keepLoader) {
          setIsLoadingSessions(false);
        }
      }
    };

    void loadSessions();

    const interval = window.setInterval(() => {
      void loadSessions(false);
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [selectedServerId]);

  useEffect(() => {
    if (!selectedServerId || !requestedSessionId) {
      setSnapshot(null);
      return;
    }

    let cancelled = false;

    const loadSnapshot = async (keepLoader = true) => {
      if (keepLoader) {
        setIsLoadingSnapshot(true);
      }

      try {
        const nextSnapshot = await getContinuitySessionSnapshot(selectedServerId, requestedSessionId);
        if (cancelled) {
          return;
        }

        setSnapshot(nextSnapshot);
        setPageError(null);
      } catch (error: any) {
        if (cancelled) {
          return;
        }

        setPageError(error.message || 'Failed to load the continuity terminal.');
      } finally {
        if (!cancelled && keepLoader) {
          setIsLoadingSnapshot(false);
        }
      }
    };

    void loadSnapshot();

    const interval = window.setInterval(() => {
      void loadSnapshot(false);
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [requestedSessionId, selectedServerId]);

  useEffect(() => {
    if (!terminalScrollRef.current) {
      return;
    }

    terminalScrollRef.current.scrollTop = terminalScrollRef.current.scrollHeight;
  }, [snapshot?.content]);

  const handleServerChange = (nextServerId: string) => {
    setSnapshot(null);
    router.push(withSelectedServerQuery('/server/commands/continuity', nextServerId));
  };

  const handleCreateSession = () => {
    if (!selectedServerId) {
      toast({
        title: 'Select a server',
        description: 'Choose a server before creating a continuity terminal.',
        variant: 'destructive',
      });
      return;
    }

    startCreatingSession(async () => {
      try {
        const result = await createContinuitySession(selectedServerId);
        router.push(withSelectedServerQuery(`/server/commands/continuity?session=${encodeURIComponent(result.sessionId)}`, selectedServerId));
      } catch (error: any) {
        toast({
          title: 'Session creation failed',
          description: error.message || 'Could not create the continuity terminal.',
          variant: 'destructive',
        });
      }
    });
  };

  const handleOpenSession = (sessionId: string) => {
    router.push(withSelectedServerQuery(`/server/commands/continuity?session=${encodeURIComponent(sessionId)}`, selectedServerId));
  };

  const handleRefreshSessions = () => {
    if (!selectedServerId) {
      return;
    }

    void listContinuitySessions(selectedServerId)
      .then((nextSessions) => {
        setSessions(nextSessions);
        setPageError(null);
      })
      .catch((error: Error) => {
        setPageError(error.message || 'Failed to load continuity sessions.');
      });
  };

  const handleRefreshSnapshot = () => {
    if (!selectedServerId || !requestedSessionId) {
      return;
    }

    setIsLoadingSnapshot(true);
    void getContinuitySessionSnapshot(selectedServerId, requestedSessionId)
      .then((nextSnapshot) => {
        setSnapshot(nextSnapshot);
        setPageError(null);
      })
      .catch((error: Error) => {
        setPageError(error.message || 'Failed to load the continuity terminal.');
      })
      .finally(() => {
        setIsLoadingSnapshot(false);
      });
  };

  const handleSendCommand = () => {
    if (!selectedServerId || !requestedSessionId || !command.trim()) {
      return;
    }

    startSendingCommand(async () => {
      try {
        const nextSnapshot = await sendContinuityCommand(selectedServerId, requestedSessionId, command);
        setCommand('');
        setSnapshot(nextSnapshot);
      } catch (error: any) {
        toast({
          title: 'Command failed',
          description: error.message || 'Could not send the command to tmux.',
          variant: 'destructive',
        });
      }
    });
  };

  const handleEndSession = () => {
    if (!selectedServerId || !requestedSessionId) {
      return;
    }

    startEndingSession(async () => {
      try {
        await terminateContinuitySession(selectedServerId, requestedSessionId);
        setSnapshot(null);
        router.replace(withSelectedServerQuery('/server/commands/continuity', selectedServerId), { scroll: false });
      } catch (error: any) {
        toast({
          title: 'Session close failed',
          description: error.message || 'Could not close the continuity session.',
          variant: 'destructive',
        });
      }
    });
  };

  const activeSessionExists = snapshot?.exists ?? false;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Continuity Terminal</h1>
          <p className="text-sm text-muted-foreground">
            Tmux-backed SSH continuity terminals that stay alive on the selected server.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-[280px]">
            <Select value={selectedServerId || undefined} onValueChange={handleServerChange} disabled={isLoadingServers || servers.length === 0}>
              <SelectTrigger>
                <SelectValue placeholder={isLoadingServers ? 'Loading servers...' : 'Select a server'} />
              </SelectTrigger>
              <SelectContent>
                {servers.map((server) => (
                  <SelectItem key={server.id} value={server.id}>
                    {server.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleCreateSession} disabled={!selectedServerId || isCreatingSession}>
            {isCreatingSession ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            New Continuity Terminal
          </Button>
        </div>
      </div>

      {pageError ? (
        <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {pageError}
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <Card className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Open Instances</h2>
              <p className="text-xs text-muted-foreground">
                {selectedServer ? `Running on ${selectedServer.name}` : 'Select a server to load tmux sessions.'}
              </p>
            </div>

            <Button variant="ghost" size="icon" onClick={handleRefreshSessions} disabled={!selectedServerId}>
              <RefreshCcw className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-3">
            {isLoadingSessions ? (
              <>
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </>
            ) : sessions.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                No continuity terminals are open on this server.
              </div>
            ) : (
              sessions.map((session) => {
                const isActive = session.id === requestedSessionId;
                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => handleOpenSession(session.id)}
                    className={`w-full rounded-lg border p-4 text-left transition ${isActive ? 'border-primary bg-primary/5' : 'hover:border-primary/40 hover:bg-muted/40'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{session.id}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {session.createdAtEpoch ? new Date(session.createdAtEpoch * 1000).toLocaleString() : 'Creation time unavailable'}
                        </div>
                      </div>

                      <SquareTerminal className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </div>

                    <div className="mt-3 flex gap-2 text-xs text-muted-foreground">
                      <span>{session.windows} window{session.windows === 1 ? '' : 's'}</span>
                      <span>{session.attachedClients} attached</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </Card>

        <Card className="min-h-[72vh] overflow-hidden p-0">
          {!selectedServerId ? (
            <div className="flex h-full min-h-[72vh] items-center justify-center p-8 text-center">
              <div className="space-y-3">
                <Server className="mx-auto h-8 w-8 text-muted-foreground" />
                <div className="text-lg font-medium">Select a server</div>
                <p className="text-sm text-muted-foreground">
                  The continuity terminal uses SSH and tmux on the selected server.
                </p>
              </div>
            </div>
          ) : !requestedSessionId ? (
            <div className="flex h-full min-h-[72vh] items-center justify-center p-8 text-center">
              <div className="space-y-3">
                <SquareTerminal className="mx-auto h-8 w-8 text-muted-foreground" />
                <div className="text-lg font-medium">Open a continuity terminal</div>
                <p className="text-sm text-muted-foreground">
                  Click an open instance or create a new continuity terminal on {selectedServer?.name ?? 'the selected server'}.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[72vh] flex-col bg-zinc-950 text-zinc-100">
              <div className="flex flex-col gap-3 border-b border-zinc-800 bg-zinc-900/70 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white">{requestedSessionId}</div>
                  <div className="text-xs text-zinc-400">
                    {selectedServer?.name ?? 'Server'}{selectedServer?.publicIp ? ` • ${selectedServer.publicIp}` : ''}
                    {snapshot?.cwd ? ` • ${snapshot.cwd}` : ''}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-zinc-700 bg-transparent text-zinc-100 hover:bg-zinc-800 hover:text-white"
                    onClick={handleRefreshSnapshot}
                    disabled={isLoadingSnapshot}
                  >
                    {isLoadingSnapshot ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                    Refresh
                  </Button>

                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleEndSession}
                    disabled={isEndingSession}
                  >
                    {isEndingSession ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                    End Session
                  </Button>
                </div>
              </div>

              <div ref={terminalScrollRef} className="flex-1 overflow-auto px-4 py-4">
                {isLoadingSnapshot && !snapshot ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full bg-zinc-800" />
                    <Skeleton className="h-4 w-5/6 bg-zinc-800" />
                    <Skeleton className="h-4 w-4/6 bg-zinc-800" />
                  </div>
                ) : activeSessionExists ? (
                  <pre className="whitespace-pre-wrap break-words font-mono text-sm leading-6 text-zinc-200">
                    {snapshot?.content || 'Session is open. Waiting for tmux output...'}
                  </pre>
                ) : (
                  <div className="space-y-3 text-center">
                    <div className="text-lg font-medium text-white">Session not found</div>
                    <p className="text-sm text-zinc-400">
                      This continuity terminal is no longer running on the selected server.
                    </p>
                  </div>
                )}
              </div>

              <div className="border-t border-zinc-800 bg-zinc-900/80 px-4 py-3">
                <div className="mb-2 text-xs text-zinc-500">
                  Commands are sent into tmux and remain available when you reopen this session.
                </div>
                <div className="flex gap-3">
                  <Input
                    value={command}
                    onChange={(event) => setCommand(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        handleSendCommand();
                      }
                    }}
                    placeholder="Enter a command and press Enter"
                    className="border-zinc-700 bg-zinc-950 text-zinc-50 placeholder:text-zinc-500"
                    disabled={!activeSessionExists || isSendingCommand}
                  />
                  <Button onClick={handleSendCommand} disabled={!activeSessionExists || isSendingCommand || !command.trim()}>
                    {isSendingCommand ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Send
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="text-sm text-muted-foreground">
        <Link href={withSelectedServerQuery('/server/commands', selectedServerId)} className="underline underline-offset-4">
          Back to server commands
        </Link>
      </div>
    </div>
  );
}
