/*
::neup.documentation::server-commands-continuity-page
::title Continuity Session List Page

Lists tmux-backed continuity terminals for the server selected by the `selectedServer` query value.

::public

This page shows all open continuity terminals on the selected server and lets the user create a new terminal.

::public end

::private

The page polls the continuity service for session updates and opens a session at `/server/commands/continuity/[id]`.

::private end

::end
*/

'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Plus, Server, SquareTerminal } from 'lucide-react';

import { Card } from '#/components/ui/card';
import { PageTitle } from '@/components/page-header';
import { Skeleton } from '#/components/ui/skeleton';
import { useToast } from '@/core/hooks/useToast';
import { withSelectedServerQuery } from '@/inapp/helpers/navigation';
import { useSelectedServerId } from '@/inapp/hooks/use-selected-server';
import { createContinuitySession, listContinuitySessions, type ContinuitySession } from '@/services/server/continuity-service';

/*
::neup.documentation::server-commands-continuity-list-client
::private

Client implementation for the continuity session list page.

::private end
::end
*/

export default function ContinuityPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const selectedServerFromUrl = useSelectedServerId();
  const pretypedCommand = searchParams.get('pretypecommand') ?? '';

  const [sessions, setSessions] = useState<ContinuitySession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [isCreatingSession, startCreatingSession] = useTransition();

  const selectedServerId = useMemo(() => selectedServerFromUrl ?? '', [selectedServerFromUrl]);

  useEffect(() => {
    if (!selectedServerId) {
      setSessions([]);
      setPageError(null);
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
    }, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [selectedServerId]);

  const handleCreateSession = () => {
    if (!selectedServerId) {
      toast({
        title: 'No server selected',
        description: 'Add a `selectedServer` query value before creating a continuity terminal.',
        variant: 'destructive',
      });
      return;
    }

    startCreatingSession(async () => {
      try {
        const result = await createContinuitySession(selectedServerId);
        const sessionPath = `/server/commands/continuity/${encodeURIComponent(result.sessionId)}`;
        const sessionHref = pretypedCommand
          ? `${sessionPath}?pretypecommand=${encodeURIComponent(pretypedCommand)}`
          : sessionPath;
        router.push(withSelectedServerQuery(sessionHref, selectedServerId));
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
    router.push(withSelectedServerQuery(`/server/commands/continuity/${encodeURIComponent(sessionId)}`, selectedServerId));
  };

  return (
    <div className="space-y-8">
      <PageTitle
        title="Continuity Sessions"
        description="Manage persistent terminal sessions on the selected server."
      />

      <button
        type="button"
        onClick={handleCreateSession}
        disabled={!selectedServerId || isCreatingSession}
        className="flex w-full items-center justify-between gap-4 rounded-lg border bg-card p-5 text-left transition hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <div className="min-w-0">
          <div className="text-base font-semibold">New Continuity Terminal</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Create a tmux-backed terminal session on the selected server.
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 text-sm font-medium">
          {isCreatingSession ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          <span>Open</span>
        </div>
      </button>

      {pageError ? (
        <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {pageError}
        </Card>
      ) : null}

      {!selectedServerId ? (
        <div className="flex min-h-[50vh] items-center justify-center rounded-lg border bg-card p-8 text-center">
          <div className="space-y-3">
            <Server className="mx-auto h-8 w-8 text-muted-foreground" />
            <div className="text-lg font-medium">No server selected</div>
            <p className="text-sm text-muted-foreground">
              Add a `selectedServer` query value to list continuity terminals for that server.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {isLoadingSessions ? (
            <>
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
            </>
          ) : sessions.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No continuity terminals are open on this server.
            </div>
          ) : (
            sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => handleOpenSession(session.id)}
                className="w-full rounded-lg border bg-card p-4 text-left transition hover:border-primary/40 hover:bg-muted/40"
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
            ))
          )}
        </div>
      )}
    </div>
  );
}
