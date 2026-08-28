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
import { useEffect, useMemo, useRef, useState, useTransition, type KeyboardEvent } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2, Server, SquareTerminal, XCircle } from 'lucide-react';

import { Button } from '#/components/ui/button';
import { Card } from '#/components/ui/card';
import { Skeleton } from '#/components/ui/skeleton';
import { useToast } from '#/core/hooks/useToast';
import { withSelectedServerQuery } from '@/helpers/navigation';
import { useSelectedServerId } from '@/hooks/use-selected-server';
import { useServerName } from '@/hooks/use-server-name';
import { getContinuitySessionSnapshot, sendContinuityCommand, sendContinuityEnter, terminateContinuitySession, type ContinuitySessionSnapshot } from '@/services/server/continuity-service';
import { getServer } from '@/services/server/server-service';

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
      setPageError(null);
      return;
    }

    getServer(selectedServerId)
      .then((server) => {
        if (cancelled) {
          return;
        }

        if (!server) {
          setPageError('Selected server was not found.');
          return;
        }

        setPageError(null);
      })
      .catch((error: Error) => {
        if (cancelled) {
          return;
        }

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

  const handleSendCommand = () => {
    if (!selectedServerId || !requestedSessionId) {
      return;
    }

    startSendingCommand(async () => {
      try {
        const nextSnapshot = command.trim()
          ? await sendContinuityCommand(selectedServerId, requestedSessionId, command)
          : await sendContinuityEnter(selectedServerId, requestedSessionId);
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
  const terminalContent = snapshot?.content?.replace(/\s+$/u, '') || 'Session is open. Waiting for tmux output...';

  const handleTerminalKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!activeSessionExists || isSendingCommand) {
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      handleSendCommand();
      return;
    }

    if (event.key === 'Backspace') {
      event.preventDefault();
      setCommand((currentCommand) => currentCommand.slice(0, -1));
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setCommand('');
      return;
    }

    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      setCommand((currentCommand) => currentCommand + event.key);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <Button asChild type="plain" size="sm" className="px-0 text-muted-foreground hover:text-foreground">
            <Link href={withSelectedServerQuery('/server/commands/continuity', selectedServerId)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">
            Continuity Terminal{' '}
            <Link href="/server/list" className="text-muted-foreground transition-colors duration-[time:600ms] hover:text-foreground">
              for{' '}
              {selectedServerName ?? 'Server'}
            </Link>
          </h1>
          <p className="text-sm text-muted-foreground">
            You're currently working on session "{requestedSessionId || 'SessionID'}"
          </p>
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
          <div className="flex h-full min-h-[72vh] flex-col text-foreground">
            <div
              ref={terminalScrollRef}
              className="flex-1 overflow-auto px-4 py-4 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              tabIndex={0}
              autoFocus
              role="textbox"
              aria-label="Continuity terminal"
              onClick={() => terminalScrollRef.current?.focus()}
              onKeyDown={handleTerminalKeyDown}
            >
              {isLoadingSnapshot && !snapshot ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-4/6" />
                </div>
              ) : activeSessionExists ? (
                <pre className="whitespace-pre-wrap break-words font-mono text-sm leading-6 text-foreground">
                  {terminalContent}
                  {' '}
                  {command}
                  {isSendingCommand ? (
                    <Loader2 className="ml-1 inline-block h-4 w-4 animate-spin align-[-0.15em]" aria-label="Processing command" />
                  ) : (
                    <span className="animate-pulse" aria-hidden="true">▌</span>
                  )}
                </pre>
              ) : (
                <div className="space-y-3 text-center">
                  <div className="text-lg font-medium">Session not found</div>
                  <p className="text-sm text-muted-foreground">
                    This continuity terminal is no longer running on the selected server.
                  </p>
                </div>
              )}
            </div>

          </div>
        )}
      </Card>

      {selectedServerId && requestedSessionId ? (
        <div className="flex justify-start">
          <Button htmlType="button" type="solid" onClick={handleEndSession} disabled={isEndingSession}>
            {isEndingSession ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
            End Session
          </Button>
        </div>
      ) : null}

    </div>
  );
}
