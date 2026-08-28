'use client';

import { Button } from "@/component/ui/button";
import { Download, GitPullRequest, RefreshCw, RotateCcw } from "lucide-react";

import { useRepoControls } from '@/components/applications/repo-controls';

interface RepoControlsProps {
  applicationId: string;
}

export function RepoControls({ applicationId }: RepoControlsProps) {
  const { loading, handleAction } = useRepoControls(applicationId);

  return (
    <div className="flex flex-wrap gap-2 pt-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleAction('clone')}
        disabled={!!loading}
      >
        <Download className="mr-2 h-4 w-4" />
        {loading === 'clone' ? 'Cloning...' : 'Clone Repository'}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleAction('reset-main')}
        disabled={!!loading}
      >
        <RotateCcw className="mr-2 h-4 w-4" />
        {loading === 'reset-main' ? 'Resetting...' : 'Reset to Main'}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleAction('pull')}
        disabled={!!loading}
      >
        <GitPullRequest className="mr-2 h-4 w-4" />
        {loading === 'pull' ? 'Pulling...' : 'Pull'}
      </Button>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => handleAction('pull-force')}
        disabled={!!loading}
      >
        <RefreshCw className="mr-2 h-4 w-4" />
        {loading === 'pull-force' ? 'Forcing...' : 'Force Pull'}
      </Button>
    </div>
  );
}
