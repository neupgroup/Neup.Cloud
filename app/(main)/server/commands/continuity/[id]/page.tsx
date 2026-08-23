/*
::neup.documentation::server-commands-continuity-session-page
::title Continuity Session Page

Displays a single tmux-backed continuity terminal selected by the route parameter.

::public

This page opens a continuity terminal session at `/server/commands/continuity/[id]` for the server selected by the `selectedServer` query value.

::public end

::private

The page validates the route session ID, polls pane output, and sends commands into tmux for the active session.

::private end

::end
*/

'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Loader2, RefreshCcw, Server, SquareTerminal, XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/core/hooks/useToast';
import { withSelectedServerQuery } from '@/inapp/helpers/navigation';
import { useSelectedServerId } from '@/inapp/hooks/use-selected-server';
import { useServerName } from '@/inapp/hooks/use-server-name';
import { getContinuitySessionSnapshot, sendContinuityCommand, terminateContinuitySession, type ContinuitySessionSnapshot } from '@/services/server/continuity-service';
import { getServer } from '@/services/server/server-service';

type ServerOption = {
  id: string;
  name: string;
  publicIp?: string | null;
};

const CONTINUITY_SESSION_ID_PATTERN = /^continuity_[A-Za-z0-9_.]+$/u;

function decodeContinuitySessionRouteValue(value: string) {
  let decoded = value.trim();

  for (let index = 0; index < 2; index += 1) {
    try {
      const nextDecoded = decodeURIComponent(decoded);
      if (nextDecoded === decoded) {
        break;
      }

      decoded = nextDecoded.trim();
    } catch {
      break;
    }
  }

  return decoded;
}

function getContinuitySessionIdFromRoute(value: string) {
  const candidate = decodeContinuitySessionRouteValue(value).split(/\\t|\t/u, 1)[0]?.trim() ?? '';
  return CONTINUITY_SESSION_ID_PATTERN.test(candidate) ? candidate : '';
}

/*
::neup.documentation::server-commands-continuity-session-client
::private

Client implementation for the continuity session page.

::private end
::end
*/

export default function ContinuitySessionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const selectedServerFromUrl = useSelectedServerId();
  const selectedServerName = useServerName();
  const pretypedCommand = searchParams.get('pretypecommand') ?? '';

  const [selectedServer, setSelectedServer] = useState<ServerOption | null>(null);
  const [snapshot, setSnapshot] = useState<ContinuitySessionSnapshot | null>(null);
  const [command, setCommand] = useState('');
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [isSendingCommand, startSendingCommand] = useTransition();
  const [isEndingSession, startEndingSession] = useTransition();

  const terminalScrollRef = useRef<HTMLDivElement>(null);

  const selectedServerId = useMemo(() => selectedServerFromUrl ?? '', [selectedServerFromUrl]);
  const rawRequestedSessionId = typeof params?.id === 'string' ? params.id : '';
  const requestedSessionId = getContinuitySessionIdFromRoute(rawRequestedSessionId);

  useEffect(() => {
    let cancelled = false;

    if (!selectedServerId) {
      setSelectedServer(null);
      setPageError(null);
      return;
    }

    getServer(selectedServerId)
      .then((server) => {
        if (cancelled) {
          return;
        }

        if (!server) {
          setSelectedServer(null);
          setPageError('Selected server was not found.');
          return;
        }

        setSelectedServer({
          id: server.id,
          name: server.name,
          publicIp: server.publicIp,
        });
        setPageError(null);
      })
      .catch((error: Error) => {
        if (cancelled) {
          return;
        }

        setSelectedServer(null);
        setPageError(error.message || 'Failed to load the selected server.');
      });

    return () => {
      cancelled = true;
    };
  }, [selectedServerId]);

  useEffect(() => {
    if (!selectedServerId || !rawRequestedSessionId) {
      return;
    }

    if (!requestedSessionId) {
      setSnapshot(null);
      router.replace(withSelectedServerQuery('/server/commands/continuity', selectedServerId), { scroll: false });
      return;
    }

    if (rawRequestedSessionId !== requestedSessionId) {
      router.replace(withSelectedServerQuery(`/server/commands/continuity/${encodeURIComponent(requestedSessionId)}`, selectedServerId), { scroll: false });
    }
  }, [rawRequestedSessionId, requestedSessionId, router, selectedServerId]);

  useEffect(() => {
    if (!pretypedCommand) {
      return;
    }

    setCommand(pretypedCommand);
  }, [pretypedCommand]);

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
            Active tmux-backed continuity terminal for the server from `selectedServer`.
          </p>
        </div>

        <div className="flex flex-col gap-2 text-right">
          <div className="text-sm font-medium">
            {selectedServerName ?? selectedServer?.name ?? 'No server selected'}
          </div>
          {selectedServer?.publicIp ? (
            <div className="text-xs text-muted-foreground">{selectedServer.publicIp}</div>
          ) : null}
        </div>
      </div>

      {pageError ? (
        <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {pageError}
        </Card>
      ) : null}

      <Card className="min-h-[72vh] overflow-hidden p-0">
        {!selectedServerId ? (
          <div className="flex h-full min-h-[72vh] items-center justify-center p-8 text-center">
            <div className="space-y-3">
              <Server className="mx-auto h-8 w-8 text-muted-foreground" />
              <div className="text-lg font-medium">No server selected</div>
              <p className="text-sm text-muted-foreground">
                Add a `selectedServer` query value to use SSH and tmux on that server.
              </p>
            </div>
          </div>
        ) : !requestedSessionId ? (
          <div className="flex h-full min-h-[72vh] items-center justify-center p-8 text-center">
            <div className="space-y-3">
              <SquareTerminal className="mx-auto h-8 w-8 text-muted-foreground" />
              <div className="text-lg font-medium">Session not found</div>
              <p className="text-sm text-muted-foreground">
                Open a continuity session from the continuity sessions list.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-[72vh] flex-col bg-zinc-950 text-zinc-100">
            <div className="flex flex-col gap-3 border-b border-zinc-800 bg-zinc-900/70 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white">{requestedSessionId}</div>
                <div className="text-xs text-zinc-400">
                  {selectedServerName ?? selectedServer?.name ?? 'Server'}{selectedServer?.publicIp ? ` • ${selectedServer.publicIp}` : ''}
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

      <div className="text-sm text-muted-foreground">
        <Link href={withSelectedServerQuery('/server/commands/continuity', selectedServerId)} className="underline underline-offset-4">
          Back to continuity sessions
        </Link>
      </div>
    </div>
  );
}
