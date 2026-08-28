'use client';

import { Button } from "#/components/ui/button";
import Icon from "#/components/ui/icon";
import { Download, GitPullRequest, RefreshCw, RotateCcw } from "lucide-react";

import { useRepoControls } from '@/components/applications/repo-controls';

interface RepoControlsProps {
  applicationId: string;
}

export function RepoControls({ applicationId }: RepoControlsProps) {
  const { loading, operationStatus, handleAction } = useRepoControls(applicationId);

  const getRepositoryIcon = (operation: 'clone' | 'pull') => {
    if (loading === operation) {
      return <Icon type="animated" from="Download" size={18} />;
    }

    if (operationStatus?.operation === operation) {
      return operationStatus.result === 'success'
        ? <Icon type="animated" from="Download" to="TickMark" position={2} size={18} />
        : <Icon type="animated" from="Download" to="CrossMark" position={2} size={18} />;
    }

    return operation === 'clone'
      ? <Download className="mr-2 h-4 w-4" />
      : <GitPullRequest className="mr-2 h-4 w-4" />;
  };

  return (
    <div className="flex flex-wrap gap-2 pt-2">
      <Button
        type="outlined"
        size="sm"
        onClick={() => handleAction('clone')}
        disabled={!!loading}
      >
        {getRepositoryIcon('clone')}
        {loading === 'clone' ? 'Cloning...' : 'Clone Repository'}
      </Button>
      <Button
        type="outlined"
        size="sm"
        onClick={() => handleAction('pull')}
        disabled={!!loading}
      >
        {getRepositoryIcon('pull')}
        {loading === 'pull'
          ? 'Pulling...'
          : operationStatus?.operation === 'pull' && operationStatus.result === 'success'
            ? 'Pull Completed.'
            : 'Pull'}
      </Button>
      <Button
        type="outlined"
        convey="warning"
        size="sm"
        onClick={() => handleAction('reset-main')}
        disabled={!!loading}
      >
        <RotateCcw className="mr-2 h-4 w-4" />
        {loading === 'reset-main' ? 'Resetting...' : 'Reset to Main'}
      </Button>
      <Button
        type="solid"
        convey="danger"
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
