'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Database, ShieldCheck } from 'lucide-react';
import { Card } from '#/components/ui/card';
import { PageTitleBack } from '@/components/page-header';
import { Button } from '#/components/ui/button';
import { useToast } from '#/core/hooks/useToast';
import {
  checkDatabaseConnection,
  deleteDatabaseConnection,
  getDatabaseConnectionMeta,
} from '@/services/database/management';

type ConnectionMeta = NonNullable<Awaited<ReturnType<typeof getDatabaseConnectionMeta>>>;

type Props = {
  params: Promise<{ id: string }>;
};

export default function DatabaseConnectionPropertiesPage({ params }: Props) {
  const { id } = use(params);
  const { toast } = useToast();
  const router = useRouter();

  const [connection, setConnection] = useState<ConnectionMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [isChecking, setIsChecking] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleCheckConnection = async () => {
    if (!connection) {
      return;
    }

    setIsChecking(true);
    try {
      const result = await checkDatabaseConnection(connection.id);
      toast({
        title: result.success ? 'Connection healthy' : 'Connection failed',
        description: result.message,
        variant: result.success ? 'default' : 'destructive',
      });
    } catch (error: any) {
      toast({
        title: 'Connection check failed',
        description: error?.message || 'Unable to check connection.',
        variant: 'destructive',
      });
    } finally {
      setIsChecking(false);
    }
  };

  const handleDeleteConnection = async () => {
    if (!connection) {
      return;
    }

    setIsDeleting(true);
    try {
      const result = await deleteDatabaseConnection(connection.id);
      toast({
        title: 'Connection deleted',
        description: result.message,
      });
      router.push('/database');
    } catch (error: any) {
      toast({
        title: 'Delete failed',
        description: error?.message || 'Unable to delete connection.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const title = connection?.title || 'Connection properties';
  const description = connection?.description || 'External database connection';

  return (
    <div className="grid gap-8 pb-20">
      <PageTitleBack
        backHref={`/database/${id}`}
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
          <Card className="p-4">
            <div className="text-xs uppercase text-muted-foreground mb-2">Connection String</div>
            <div className="text-sm font-mono break-all">{connection.credentails}</div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="text-xs uppercase text-muted-foreground mb-1">Connection Test</div>
                <p className="text-sm text-muted-foreground">Check whether the saved connection can still be maintained.</p>
              </div>
              <Button onClick={handleCheckConnection} type="outlined" disabled={isChecking || isDeleting}>
                {isChecking ? 'Checking...' : 'Check for connection'}
              </Button>
            </div>
            {connection.lastValidatedAt && (
              <div className="mt-3 text-xs text-muted-foreground flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Last checked: {new Date(connection.lastValidatedAt).toLocaleString()}</span>
              </div>
            )}
          </Card>

          <Card className="p-4 border-destructive/20 bg-destructive/5">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="text-xs uppercase text-muted-foreground mb-1">Danger Zone</div>
                <p className="text-sm text-muted-foreground">Remove this saved connection from Neup.Cloud.</p>
              </div>
              <Button onClick={handleDeleteConnection} type="solid" disabled={isDeleting || isChecking}>
                {isDeleting ? 'Deleting...' : 'Delete connection'}
              </Button>
            </div>
          </Card>
        </>
      ) : null}

      {isLoading ? (
        <Card className="p-4 text-sm text-muted-foreground">Loading...</Card>
      ) : null}
    </div>
  );
}
