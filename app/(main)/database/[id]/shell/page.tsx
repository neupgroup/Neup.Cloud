'use client';

import { use, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, Play, Terminal, Trash2 } from 'lucide-react';
import { PageTitleBack } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/core/hooks/use-toast';
import { executeDatabaseShellQuery, getDatabaseShellMeta } from '@/services/database/management';
import type { DatabaseConnectionType, DatabaseShellQueryResult } from '@/services/database/types';

const QUICK_QUERIES: Record<DatabaseConnectionType, Array<{ label: string; query: string }>> = {
  postgres: [
    { label: 'List tables', query: "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;" },
    { label: 'Current user', query: 'SELECT current_user;' },
    { label: 'Current DB', query: 'SELECT current_database();' },
  ],
  mysql: [
    { label: 'List tables', query: 'SHOW TABLES;' },
    { label: 'Current user', query: 'SELECT CURRENT_USER();' },
    { label: 'Current DB', query: 'SELECT DATABASE();' },
  ],
  mariadb: [
    { label: 'List tables', query: 'SHOW TABLES;' },
    { label: 'Current user', query: 'SELECT CURRENT_USER();' },
    { label: 'Current DB', query: 'SELECT DATABASE();' },
  ],
  sqlite: [],
  firestore: [],
};

const QUERY_TEMPLATES: Record<
  DatabaseConnectionType,
  Array<{ label: string; query: string }>
> = {
  postgres: [
    {
      label: 'Select',
      query: `-- Replace exampleTable and exampleField before running.
SELECT
  exampleField
FROM exampleTable
WHERE exampleField = 'exampleValue'
LIMIT 10
OFFSET 0;`,
    },
    {
      label: 'Insert',
      query: `-- Replace exampleTable and exampleField before running.
INSERT INTO exampleTable (
  exampleField
) VALUES (
  'exampleValue'
);`,
    },
    {
      label: 'Update',
      query: `-- Replace exampleTable and exampleField before running.
UPDATE exampleTable
SET exampleField = 'updatedValue'
WHERE exampleField = 'matchValue';`,
    },
    {
      label: 'Delete',
      query: `-- Replace exampleTable and exampleField before running.
DELETE FROM exampleTable
WHERE exampleField = 'matchValue';`,
    },
  ],
  mysql: [
    {
      label: 'Select',
      query: `-- Replace exampleTable and exampleField before running.
SELECT
  exampleField
FROM exampleTable
WHERE exampleField = 'exampleValue'
LIMIT 10
OFFSET 0;`,
    },
    {
      label: 'Insert',
      query: `-- Replace exampleTable and exampleField before running.
INSERT INTO exampleTable (
  exampleField
) VALUES (
  'exampleValue'
);`,
    },
    {
      label: 'Update',
      query: `-- Replace exampleTable and exampleField before running.
UPDATE exampleTable
SET exampleField = 'updatedValue'
WHERE exampleField = 'matchValue'
LIMIT 10;`,
    },
    {
      label: 'Delete',
      query: `-- Replace exampleTable and exampleField before running.
DELETE FROM exampleTable
WHERE exampleField = 'matchValue'
LIMIT 10;`,
    },
  ],
  mariadb: [
    {
      label: 'Select',
      query: `-- Replace exampleTable and exampleField before running.
SELECT
  exampleField
FROM exampleTable
WHERE exampleField = 'exampleValue'
LIMIT 10
OFFSET 0;`,
    },
    {
      label: 'Insert',
      query: `-- Replace exampleTable and exampleField before running.
INSERT INTO exampleTable (
  exampleField
) VALUES (
  'exampleValue'
);`,
    },
    {
      label: 'Update',
      query: `-- Replace exampleTable and exampleField before running.
UPDATE exampleTable
SET exampleField = 'updatedValue'
WHERE exampleField = 'matchValue'
LIMIT 10;`,
    },
    {
      label: 'Delete',
      query: `-- Replace exampleTable and exampleField before running.
DELETE FROM exampleTable
WHERE exampleField = 'matchValue'
LIMIT 10;`,
    },
  ],
  sqlite: [],
  firestore: [],
};

function formatCell(value: unknown) {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

type Props = {
  params: Promise<{ id: string }>;
};

export default function DatabaseShellPage({ params }: Props) {
  const { id } = use(params);
  const { toast } = useToast();
  const [query, setQuery] = useState(`-- Replace exampleTable and exampleField before running.
SELECT
  exampleField
FROM exampleTable
WHERE exampleField = 'exampleValue'
LIMIT 10
OFFSET 0;`);
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<DatabaseShellQueryResult | null>(null);
  const [error, setError] = useState('');

  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [connectionType, setConnectionType] = useState<DatabaseConnectionType | null>(null);
  const [isLoadingMeta, setIsLoadingMeta] = useState(true);

  useEffect(() => {
    let cancelled = false;

    setIsLoadingMeta(true);
    setError('');
    setResult(null);

    getDatabaseShellMeta(id)
      .then((meta) => {
        if (cancelled) {
          return;
        }

        if (!meta) {
          setError('Database connection not found.');
          setConnectionId(null);
          setTitle(null);
          setConnectionType(null);
          return;
        }

        setConnectionId(meta.id);
        setTitle(meta.title);
        setConnectionType(meta.connectionType);
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }

        setError(err instanceof Error ? err.message : 'Unable to load database connection.');
        setConnectionId(null);
        setTitle(null);
        setConnectionType(null);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingMeta(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const runQuery = async () => {
    if (!connectionId) {
      toast({
        variant: 'destructive',
        title: 'Connection not loaded',
        description: 'Please wait for the connection to load and try again.',
      });
      return;
    }

    if (!query.trim()) {
      toast({
        variant: 'destructive',
        title: 'Empty query',
        description: 'Please enter a SQL query to execute.',
      });
      return;
    }

    setIsExecuting(true);
    setError('');

    try {
      const response = await executeDatabaseShellQuery(connectionId, query);
      setResult(response);

      toast({
        title: 'Query executed',
        description: response.message || `Returned ${response.rowCount} rows.`,
      });
    } catch (err: any) {
      const message = err?.message || 'Unable to execute query.';
      setError(message);
      setResult(null);

      toast({
        variant: 'destructive',
        title: 'Execution failed',
        description: message,
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const backHref = connectionId ? `/database/${connectionId}` : '/database';
  const description = title ? `Run SQL commands on ${title}` : 'Run SQL commands on your external database connection';

  return (
    <div className="grid gap-8 pb-20">
      <PageTitleBack
        backHref={backHref}
        title={
          <span className="flex items-center gap-2">
            <Terminal className="h-7 w-7 text-primary" />
            SQL Shell
          </span>
        }
        description={description}
      />

      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="pt-6 text-sm text-amber-900/70 dark:text-amber-500/70">
          Commands execute directly on your external database connection. Use caution with UPDATE/DELETE/DROP statements.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>Query Editor</CardTitle>
              <CardDescription>
                Connection type:{' '}
                <span className="uppercase">{connectionType ? connectionType : isLoadingMeta ? 'loading' : 'unknown'}</span>
              </CardDescription>
            </div>
            <Badge variant="outline" className="uppercase">
              {connectionType ? connectionType : isLoadingMeta ? 'loading' : 'unknown'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-h-[200px] font-mono text-sm"
            placeholder={`-- Replace exampleTable and exampleField before running.
SELECT
  exampleField
FROM exampleTable
WHERE exampleField = 'exampleValue'
LIMIT 10
OFFSET 0;`}
            disabled={isExecuting || isLoadingMeta || !connectionId}
          />

          <div className="flex flex-wrap gap-2">
            {connectionType
              ? QUICK_QUERIES[connectionType].map((item) => (
                  <Button
                    key={item.label}
                    variant="outline"
                    size="sm"
                    onClick={() => setQuery(item.query)}
                    disabled={isExecuting || isLoadingMeta}
                  >
                    {item.label}
                  </Button>
                ))
              : null}
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Templates</p>
            <div className="flex flex-wrap gap-2">
              {connectionType
                ? QUERY_TEMPLATES[connectionType].map((item) => (
                    <Button
                      key={item.label}
                      variant="secondary"
                      size="sm"
                      onClick={() => setQuery(item.query)}
                      disabled={isExecuting || isLoadingMeta}
                      className="uppercase"
                    >
                      {item.label}
                    </Button>
                  ))
                : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={runQuery} disabled={isExecuting || isLoadingMeta || !connectionId || !query.trim()}>
              {isExecuting ? <Clock className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              {isExecuting ? 'Executing...' : 'Run Query'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setQuery('');
                setResult(null);
                setError('');
              }}
              disabled={isExecuting || isLoadingMeta}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-500/20">
          <CardContent className="pt-6 text-sm text-red-600 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5" />
            <span>{error}</span>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Result
            </CardTitle>
            <CardDescription>
              {result.message || `${result.rowCount} rows`} in {result.executionTimeMs}ms
            </CardDescription>
          </CardHeader>
          <CardContent>
            {result.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No rows returned.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {result.columns.map((column) => (
                      <TableHead key={column} className="font-mono text-xs">
                        {column}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.rows.map((row, index) => (
                    <TableRow key={index}>
                      {result.columns.map((column) => (
                        <TableCell key={`${index}-${column}`}>
                          <div className="max-w-[360px] break-words whitespace-pre-wrap text-xs font-mono">
                            {formatCell(row[column])}
                          </div>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
