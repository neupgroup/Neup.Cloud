'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart3, ChevronRight, Database, Settings, Table, Terminal } from 'lucide-react';
import { Card } from '@/component/ui/card';
import { PageTitleBack } from '@/components/page-header';
import { getDatabaseConnectionMeta } from '@/services/database/management';

type ConnectionMeta = NonNullable<Awaited<ReturnType<typeof getDatabaseConnectionMeta>>>;

type Props = {
  params: Promise<{ id: string }>;
};

export default function DatabaseConnectionDetailsPage({ params }: Props) {
  const { id } = use(params);

  const [connection, setConnection] = useState<ConnectionMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setLoadError('');

    getDatabaseConnectionMeta(id)
      .then((meta) => {
        if (cancelled) {
          return;
        }

        if (!meta) {
          setConnection(null);
          setLoadError('Database connection not found.');
          return;
        }

        setConnection(meta);
      })
      .catch((error) => {
        if (!cancelled) {
          setConnection(null);
          setLoadError(error instanceof Error ? error.message : 'Unable to load database connection.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const title = connection?.title || 'Database connection';
  const description = connection?.description || 'External database connection';

  return (
    <div className="grid gap-8 pb-20">
      <PageTitleBack
        backHref="/database"
        title={
          <span className="flex items-center gap-3">
            <span className="p-2.5 bg-primary/10 rounded-xl">
              <Database className="w-6 h-6 text-primary" />
            </span>
            <span>{title}</span>
          </span>
        }
        description={description}
      />

      {loadError && (
        <Card className="p-4 text-sm text-destructive">
          {loadError}
        </Card>
      )}

      {connection ? (
        <>
          <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
            <Link href={`/database/${connection.id}/table`} className="block">
              <div className="p-4 min-w-0 w-full transition-colors hover:bg-muted/50 group flex items-start gap-4 cursor-pointer">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between mb-0 h-8">
                    <h3 className="font-semibold leading-none tracking-tight truncate pr-4 text-foreground group-hover:underline decoration-muted-foreground/30 underline-offset-4">
                      Tables and Views
                    </h3>
                    <div className="h-8 w-8 flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors">
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 flex items-center gap-2">
                    <Table className="h-4 w-4" />
                    Browse all tables and views for this external connection.
                  </p>
                </div>
              </div>
            </Link>

            <Link href={`/database/${connection.id}/shell`} className="block border-t border-border">
              <div className="p-4 min-w-0 w-full transition-colors hover:bg-muted/50 group flex items-start gap-4 cursor-pointer">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between mb-0 h-8">
                    <h3 className="font-semibold leading-none tracking-tight truncate pr-4 text-foreground group-hover:underline decoration-muted-foreground/30 underline-offset-4">
                      SQL Shell
                    </h3>
                    <div className="h-8 w-8 flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors">
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 flex items-center gap-2">
                    <Terminal className="h-4 w-4" />
                    Execute SQL commands against this external connection.
                  </p>
                </div>
              </div>
            </Link>

            <Link href={`/database/${connection.id}/visualizer`} className="block border-t border-border">
              <div className="p-4 min-w-0 w-full transition-colors hover:bg-muted/50 group flex items-start gap-4 cursor-pointer">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between mb-0 h-8">
                    <h3 className="font-semibold leading-none tracking-tight truncate pr-4 text-foreground group-hover:underline decoration-muted-foreground/30 underline-offset-4">
                      Visualizer
                    </h3>
                    <div className="h-8 w-8 flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors">
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Explore the schema visually and understand relationships.
                  </p>
                </div>
              </div>
            </Link>

            <Link href={`/database/${connection.id}/properties`} className="block border-t border-border">
              <div className="p-4 min-w-0 w-full transition-colors hover:bg-muted/50 group flex items-start gap-4 cursor-pointer">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between mb-0 h-8">
                    <h3 className="font-semibold leading-none tracking-tight truncate pr-4 text-foreground group-hover:underline decoration-muted-foreground/30 underline-offset-4">
                      Connection Properties
                    </h3>
                    <div className="h-8 w-8 flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors">
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Review the connection string, test connectivity, or delete the connection.
                  </p>
                </div>
              </div>
            </Link>
          </Card>
        </>
      ) : null}

      {isLoading ? (
        <Card className="p-4 text-sm text-muted-foreground">Loading...</Card>
      ) : null}
    </div>
  );
}
