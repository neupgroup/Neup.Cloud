'use client';

import { useState, useCallback } from 'react';
import { ApplicationCommandLogs } from './application-command-logs';
import { LifecycleSection } from './lifecycle-section';

interface ApplicationLifecycleWrapperProps {
  applicationId: string;
  application: any;
}

/**
 * Client wrapper that shares the "is a command currently running?" state
 * between the command history poller and the lifecycle cards.
 *
 * A command is considered running when there is a pending log entry that was
 * started less than 20 minutes ago. Anything older is treated as timed-out /
 * cancelled and will not block the UI.
 */
export function ApplicationLifecycleWrapper({
  applicationId,
  application,
}: ApplicationLifecycleWrapperProps) {
  const [isCommandRunning, setIsCommandRunning] = useState(false);

  const handleRunningStateChange = useCallback((running: boolean) => {
    setIsCommandRunning(running);
  }, []);

  return (
    <>
      <LifecycleSection application={application} isCommandRunning={isCommandRunning} />
      <ApplicationCommandLogs
        applicationId={applicationId}
        onRunningStateChange={handleRunningStateChange}
      />
    </>
  );
}
