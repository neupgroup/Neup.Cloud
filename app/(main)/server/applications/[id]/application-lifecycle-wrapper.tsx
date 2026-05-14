'use client';

import { useState, useCallback } from 'react';
import { ApplicationCommandLogs } from './application-command-logs';
import { LifecycleSection } from './lifecycle-section';

interface ApplicationLifecycleWrapperProps {
  applicationId: string;
  application: any;
}

export function ApplicationLifecycleWrapper({
  applicationId,
  application,
}: ApplicationLifecycleWrapperProps) {
  const [runningCommandName, setRunningCommandName] = useState<string | null>(null);

  const handleRunningCommandChange = useCallback((name: string | null) => {
    setRunningCommandName(name);
  }, []);

  return (
    <>
      <LifecycleSection application={application} runningCommandName={runningCommandName} />
      <ApplicationCommandLogs
        applicationId={applicationId}
        onRunningCommandChange={handleRunningCommandChange}
      />
    </>
  );
}
