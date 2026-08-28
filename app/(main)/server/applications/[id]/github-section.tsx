'use client';

import { Github, Link as LinkIcon } from "lucide-react";

import { Card } from "#/components/ui/card";

import { RepoControls } from "../repo-controls";

export function GitHubSection({ application }: { application: any }) {
  if (!application.repository) {
    return null;
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-5 duration-500 delay-200">
      <h3 className="text-lg font-medium flex items-center gap-2">
        <Github className="h-5 w-5" />
        Repository
      </h3>

      <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
        <div className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <LinkIcon className="h-4 w-4 mt-1 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Repository URL</p>
              <p className="font-mono text-sm break-all">{application.repository}</p>
            </div>
          </div>

          <RepoControls applicationId={application.id} />
        </div>
      </Card>
    </div>
  );
}
