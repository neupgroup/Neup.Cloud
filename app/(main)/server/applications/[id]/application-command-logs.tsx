'use client';

import { useEffect, useState, useCallback } from 'react';
import { getCommandLog, type CommandLog } from '@/services/logs/command-log';
import { CommandLogList, CommandLogListSkeleton } from '@/app/(main)/server/commands/command-log-card';
import { useSelectedServerId } from '@/core/hooks/use-selected-server';

/** A command is considered "running" if it has status "pending" and was started
 *  less than 20 minutes ago. Anything older is treated as cancelled/timed-out. */
const RUNNING_TIMEOUT_MS = 20 * 60 * 1000;

/**
 * Returns the name of the currently running command (last word of commandName,
 * e.g. "MyApp build" → "build"), or null if nothing is running.
 */
export function getRunningCommandName(logs: CommandLog[]): string | null {
  const now = Date.now();
  const running = logs.find(
    (log) =>
      log.status === 'pending' &&
      now - new Date(log.runAt).getTime() < RUNNING_TIMEOUT_MS
  );
  if (!running) return null;
  const parts = running.commandName?.trim().split(' ') ?? [];
  return parts.length > 0 ? parts[parts.length - 1].toLowerCase() : null;
}

interface ApplicationCommandLogsProps {
  applicationId: string;
  onRunningCommandChange?: (runningCommandName: string | null) => void;
}

export function ApplicationCommandLogs({
  applicationId,
  onRunningCommandChange,
}: ApplicationCommandLogsProps) {
  const [logs, setLogs] = useState<CommandLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const selectedServerId = useSelectedServerId();

  const fetchLogs = useCallback(async () => {
    if (!selectedServerId) {
      setLogs([]);
      onRunningCommandChange?.(null);
      setIsLoading(false);
      return;
    }

    try {
      const result = await getCommandLog({ serverId: selectedServerId, source: `application:${applicationId}`, limit: 3, offset: 0 });
      setLogs(result);
      onRunningCommandChange?.(getRunningCommandName(result));
    } finally {
      setIsLoading(false);
    }
  }, [applicationId, onRunningCommandChange, selectedServerId]);

  useEffect(() => {
    void fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  if (!isLoading && logs.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">Command History</h3>
      {isLoading ? (
        <CommandLogListSkeleton rows={3} />
      ) : (
        <CommandLogList logs={logs} showSourceLink={false} />
      )}
    </div>
  );
}
