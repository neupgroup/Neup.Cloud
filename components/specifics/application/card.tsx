import type { ApplicationCardStatus } from '@/services/server/applications/status-card';
import { getLanguageDisplay, getStatusDotClass } from '@/services/server/applications/status-card';
import { Badge } from '@/component/ui/badge';
import { Skeleton } from '@/component/ui/skeleton';
import { cn } from '@/core/utils';
import { AppWindow, Code, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export type ApplicationCardProps = {
  application: {
    name: string;
    appIcon?: string;
    language: string;
  };
  status?: ApplicationCardStatus;
  href?: string;
  sourceLabel?: string;
};

export function ApplicationCard({ application, status, href, sourceLabel }: ApplicationCardProps) {
  const languageDisplay = getLanguageDisplay(application.language);
  const displayStatus = status || { tone: 'gray' as const, label: 'checking', detail: 'Checking...' };

  const content = (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1 flex items-start gap-3">
        <div className="h-12 w-12 rounded-xl border bg-muted overflow-hidden flex items-center justify-center shrink-0 shadow-sm">
          {application.appIcon ? (
            <img src={application.appIcon} alt="Application icon" className="h-full w-full object-cover" />
          ) : (
            <AppWindow className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <h3 className="font-medium text-foreground truncate group-hover:underline underline-offset-4 decoration-muted-foreground/30">
            {application.name}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-xs font-normal text-muted-foreground bg-secondary/50 px-1.5 h-5">
              <Code className="h-3 w-3 mr-1" />
              {languageDisplay}
            </Badge>
            {sourceLabel && (
              <Badge variant="outline" className="text-xs font-normal px-1.5 h-5">
                {sourceLabel}
              </Badge>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
              <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', getStatusDotClass(displayStatus.tone), displayStatus.tone === 'green' && 'animate-pulse')} />
              <span className="font-medium capitalize text-foreground">{displayStatus.label}</span>
              {displayStatus.detail && <span className="truncate">{displayStatus.detail}</span>}
            </div>
          </div>
        </div>
      </div>
      {href && (
        <div className="h-8 w-8 flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors shrink-0">
          <ChevronRight className="h-4 w-4" />
        </div>
      )}
    </div>
  );

  return (
    <div className="p-4 hover:bg-muted/50 transition-colors group">
      {href ? <Link href={href} className="block">{content}</Link> : content}
    </div>
  );
}

export function ApplicationCardSkeleton() {
  return (
    <div className="flex items-start gap-3 p-4">
      <Skeleton className="h-12 w-12 rounded-xl" />
      <div className="flex-1 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-4 rounded-full" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>
    </div>
  );
}
