'use client';

import { useEffect, useState, useCallback } from 'react';
import Cookies from 'universal-cookie';
import { getCommandLog, type CommandLog } from '@/services/logs/command-log';
import { CommandLogList } from '@/app/(main)/server/commands/command-log-card';

/** A command is considered "running" if it has status "pending" and was started
 *  less than 20 minutes ago. Anything older is treated as cancelled/timed-out. */
const RUNNING_TIMEOUT_MS = 20 * 60 * 1000;

export function isCommandRunningNow(logs: CommandLog[]): boolean {
  const now = Date.now();
  return logs.some(
    (log) =>
      log.status === 'pending' &&
      now - new Date(log.runAt).getTime() < RUNNING_TIMEOUT_MS
  );
}

interface ApplicationCommandLogsProps {
  applicationId: string;
  onRunningStateChange?: (isRunning: boolean) => void;
}

export function ApplicationCommandLogs({
  applicationId,
  onRunningStateChange,
}: ApplicationCommandLogsProps) {
  const [logs, setLogs] = useState<CommandLog[]>([]);

  const fetchLogs = useCallback(async () => {
    const cookies = new Cookies(null, { path: '/' });
    const serverId = cookies.get('selected_server');
    if (!serverId) return;
    const result = await getCommandLog({ serverId, source: `application:${applicationId}`, limit: 3, offset: 0 });
    setLogs(result);
    onRunningStateChange?.(isCommandRunningNow(result));
  }, [applicationId, onRunningStateChange]);

  useEffect(() => {
    void fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  if (logs.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">Command History</h3>
      <CommandLogList logs={logs} showSourceLink={false} />
    </div>
  );
}
