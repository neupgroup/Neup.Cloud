'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Loader2, PlusCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { ApplicationCard, ApplicationCardSkeleton } from './card';
import { getApplicationItems } from '@/services/server/applications/queries';
import type { ApplicationItem, ApplicationSource, ApplicationStatusFilter } from '@/services/server/applications/queries';

export type ApplicationSectionProps = {
  showAddButton?: boolean;
  statusFilter?: ApplicationStatusFilter | ApplicationStatusFilter[];
  source?: ApplicationSource;
  title?: string;
  description?: string;
  emptyMessage?: string;
  /** If true, returns null when there are no items (useful for dashboard widgets) */
  hideWhenEmpty?: boolean;
};

export function ApplicationSection({
  showAddButton = false,
  statusFilter = 'all',
  source = 'all',
  title,
  description,
  emptyMessage,
  hideWhenEmpty = false,
}: ApplicationSectionProps) {
  const [items, setItems] = useState<ApplicationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const isFirstLoadRef = useRef(true);

  useEffect(() => {
    let cancelled = false;

    const fetch = async () => {
      setIsLoading(true);
      try {
        const result = await getApplicationItems(source, statusFilter);
        if (!cancelled) {
          setItems(result);
          setHasLoadedOnce(true);
          isFirstLoadRef.current = false;
        }
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void fetch();
    return () => { cancelled = true; };
  }, [source, statusFilter]);

  if (!isLoading && items.length === 0 && hideWhenEmpty) return null;

  const showInitialSkeleton = isLoading && !hasLoadedOnce;
  const isRefreshing = isLoading && hasLoadedOnce;

  const resolvedTitle = title ?? (statusFilter === 'running' ? 'Running Applications' : 'Applications');
  const resolvedDescription = description ?? (statusFilter === 'running' ? 'Currently running applications.' : 'All deployed applications.');
  const resolvedEmpty = emptyMessage ?? (statusFilter === 'running' ? 'No applications are currently running.' : 'No applications found.');

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold tracking-tight">{resolvedTitle}</h2>
          {isRefreshing ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Refreshing applications" />
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">{resolvedDescription}</p>
      </div>

      <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
        {showAddButton && (
          <Link href="/server/applications/deploy" className="block p-4 border-b border-border hover:bg-muted/50 transition-colors group">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <PlusCircle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-foreground">Deploy New Application</h3>
                <p className="text-sm text-muted-foreground">Deploy a new application to your infrastructure</p>
              </div>
            </div>
          </Link>
        )}

        {showInitialSkeleton ? (
          <>
            <ApplicationCardSkeleton />
            <ApplicationCardSkeleton />
            <ApplicationCardSkeleton />
          </>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">{resolvedEmpty}</div>
        ) : (
          items.map((item, index) => (
            <div key={item.id} className={index !== items.length - 1 ? 'border-b border-border' : ''}>
              <ApplicationCard
                application={item.application}
                status={item.status}
                href={item.href}
                sourceLabel={item.sourceLabel}
              />
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
