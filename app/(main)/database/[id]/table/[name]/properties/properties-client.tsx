'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, KeyRound, Plus, Trash2 } from 'lucide-react';
import type { DatabaseTableProperties } from '@/services/database/types';
import { addTablePrimaryKeyAction,
  createTableIndexAction,
  deleteTableAction,
  dropTableColumnAction,
  dropTableIndexAction,
} from '@/services/database/management';
import { Alert, AlertDescription, AlertTitle } from '@/component/ui/alert';
import { Badge } from '@/component/ui/badge';
import { Button } from '@/component/ui/button';
import { Card } from '@/component/ui/card';
import { Checkbox } from '@/component/ui/checkbox';
import { Input } from '@/component/ui/input';
import { Label } from '@/component/ui/label';
import { Switch } from '@/component/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/component/ui/table';
import { useToast } from '@/core/hooks/useToast';

type Props = {
  connectionId: string;
  tableName: string;
  properties: DatabaseTableProperties;
};

function formatDefaultValue(value: string | null) {
  if (value === null || value === '') {
    return 'None';
  }

  return value;
}

function toggleSelection(current: string[], value: string, checked: boolean) {
  if (checked) {
    return current.includes(value) ? current : [...current, value];
  }

  return current.filter((item) => item !== value);
}

function formatIndexColumns(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join(', ');
  }

  if (typeof value === 'string') {
    return value;
  }

  return 'Unknown';
}

export function TablePropertiesClient({ connectionId, tableName, properties }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [indexName, setIndexName] = useState('');
  const [indexColumns, setIndexColumns] = useState<string[]>([]);
  const [uniqueIndex, setUniqueIndex] = useState(false);
  const [primaryKeyColumns, setPrimaryKeyColumns] = useState<string[]>([]);
  const [constraintName, setConstraintName] = useState('');

  const runMutation = (
    action: () => Promise<{ message: string }>,
    successTitle: string,
    onSuccess?: () => void
  ) => {
    startTransition(async () => {
      try {
        const result = await action();
        toast({
          title: successTitle,
          description: result.message,
        });
        onSuccess?.();
      } catch (error: any) {
        toast({
          title: 'Action failed',
          description: error?.message || 'Unable to complete the requested action.',
          variant: 'destructive',
        });
      }
    });
  };

  const handleCreateIndex = () => {
    runMutation(
      () =>
        createTableIndexAction({
          connectionId,
          tableName,
          indexName,
          columnNames: indexColumns,
          unique: uniqueIndex,
        }),
      'Index created',
      () => {
        setIndexName('');
        setIndexColumns([]);
        setUniqueIndex(false);
        router.refresh();
      }
    );
  };

  const handleAddPrimaryKey = () => {
    runMutation(
      () =>
        addTablePrimaryKeyAction({
          connectionId,
          tableName,
          columnNames: primaryKeyColumns,
          constraintName,
        }),
      'Primary key added',
      () => {
        setPrimaryKeyColumns([]);
        setConstraintName('');
        router.refresh();
      }
    );
  };

  const handleDropColumn = (columnName: string) => {
    const confirmed = window.confirm(
      `Drop column "${columnName}" from "${tableName}"? This cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    runMutation(
      () =>
        dropTableColumnAction({
          connectionId,
          tableName,
          columnName,
        }),
      'Column dropped',
      () => {
        router.refresh();
      }
    );
  };

  const handleDropIndex = (indexNameToDrop: string) => {
    const confirmed = window.confirm(
      `Drop index "${indexNameToDrop}" from "${tableName}"? Queries depending on it may slow down.`
    );

    if (!confirmed) {
      return;
    }

    runMutation(
      () =>
        dropTableIndexAction({
          connectionId,
          tableName,
          indexName: indexNameToDrop,
        }),
      'Index dropped',
      () => {
        router.refresh();
      }
    );
  };

  const handleDeleteTable = () => {
    const confirmation = window.prompt(
      `Type "${tableName}" to delete this table permanently.`
    );

    if (confirmation !== tableName) {
      if (confirmation !== null) {
        toast({
          title: 'Delete cancelled',
          description: 'The table name did not match, so nothing was deleted.',
          variant: 'destructive',
        });
      }

      return;
    }

    runMutation(
      () =>
        deleteTableAction({
          connectionId,
          tableName,
        }),
      'Table deleted',
      () => {
        router.push(`/database/${connectionId}/table`);
      }
    );
  };

  const schemaChangesEnabled = properties.supportsSchemaChanges;
  const hasPrimaryKey = properties.primaryKeyColumns.length > 0;
  const removableIndexes = properties.indexes.filter((index) => !index.isPrimary);

  return (
    <div className="grid gap-6">
      {!schemaChangesEnabled && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Read-only relation</AlertTitle>
          <AlertDescription>
            This {properties.relationType} can be inspected here, but schema changes are currently only enabled for SQL tables.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground mb-2">Relation Type</div>
          <Badge variant="outline" className="uppercase">{properties.relationType}</Badge>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground mb-2">Columns</div>
          <div className="text-2xl font-semibold">{properties.columns.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground mb-2">Indexes</div>
          <div className="text-2xl font-semibold">{properties.indexes.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground mb-2">Rows</div>
          <div className="text-2xl font-semibold">{properties.rowCount === null ? 'Unknown' : properties.rowCount}</div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold">Columns</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Review data types, key status, defaults, and drop columns you no longer need.
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Nullable</TableHead>
              <TableHead>Default</TableHead>
              <TableHead>Flags</TableHead>
              <TableHead className="w-[120px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {properties.columns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No columns found for this relation.
                </TableCell>
              </TableRow>
            ) : (
              properties.columns.map((column) => (
                <TableRow key={column.name}>
                  <TableCell className="font-mono text-xs">{column.name}</TableCell>
                  <TableCell>{column.dataType}</TableCell>
                  <TableCell>{column.isNullable ? 'Yes' : 'No'}</TableCell>
                  <TableCell className="max-w-[260px]">
                    <div className="truncate font-mono text-xs">{formatDefaultValue(column.defaultValue)}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {column.isPrimaryKey && <Badge>Primary key</Badge>}
                      {column.indexNames.length > 0 && <Badge variant="secondary">Indexed</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {schemaChangesEnabled ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleDropColumn(column.name)}
                      >
                        Drop
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Read only</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold">Indexes</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Existing indexes and their covered columns.
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Columns</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="w-[120px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {properties.indexes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    No indexes found.
                  </TableCell>
                </TableRow>
              ) : (
                properties.indexes.map((index) => (
                  <TableRow key={index.name}>
                    <TableCell className="font-mono text-xs">{index.name}</TableCell>
                    <TableCell className="font-mono text-xs">{formatIndexColumns(index.columns)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {index.isPrimary && <Badge>Primary</Badge>}
                        {index.isUnique && <Badge variant="secondary">Unique</Badge>}
                        {!index.isPrimary && !index.isUnique && <Badge variant="outline">Standard</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {!index.isPrimary && schemaChangesEnabled ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isPending}
                          onClick={() => handleDropIndex(index.name)}
                        >
                          Drop
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">{index.isPrimary ? 'Protected' : 'Read only'}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        <Card className="p-4 space-y-4">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create Index
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Add a standard or unique index across one or more columns.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="index-name">Index name</Label>
            <Input
              id="index-name"
              value={indexName}
              onChange={(event) => setIndexName(event.target.value)}
              placeholder="users_email_idx"
              disabled={!schemaChangesEnabled || isPending}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="unique-index">Unique index</Label>
              <Switch
                id="unique-index"
                checked={uniqueIndex}
                onCheckedChange={setUniqueIndex}
                disabled={!schemaChangesEnabled || isPending}
              />
            </div>

            <div className="space-y-2">
              <Label>Columns</Label>
              <div className="space-y-2 rounded-md border p-3">
                {properties.columns.map((column) => (
                  <label key={column.name} className="flex items-center gap-3 text-sm">
                    <Checkbox
                      checked={indexColumns.includes(column.name)}
                      onCheckedChange={(checked) =>
                        setIndexColumns((current) => toggleSelection(current, column.name, checked === true))
                      }
                      disabled={!schemaChangesEnabled || isPending}
                    />
                    <span className="font-mono">{column.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <Button onClick={handleCreateIndex} disabled={!schemaChangesEnabled || isPending || properties.columns.length === 0}>
            Create index
          </Button>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="p-4 space-y-4">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              Primary Key
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {hasPrimaryKey
                ? 'This table already has a primary key.'
                : 'Select one or more columns to define the table primary key.'}
            </p>
          </div>

          {hasPrimaryKey ? (
            <div className="flex flex-wrap gap-2">
              {properties.primaryKeyColumns.map((columnName) => (
                <Badge key={columnName}>{columnName}</Badge>
              ))}
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="constraint-name">Constraint name</Label>
                <Input
                  id="constraint-name"
                  value={constraintName}
                  onChange={(event) => setConstraintName(event.target.value)}
                  placeholder={`${properties.table}_pkey`}
                  disabled={!schemaChangesEnabled || isPending}
                />
              </div>

              <div className="space-y-2">
                <Label>Primary key columns</Label>
                <div className="space-y-2 rounded-md border p-3">
                  {properties.columns.map((column) => (
                    <label key={column.name} className="flex items-center gap-3 text-sm">
                      <Checkbox
                        checked={primaryKeyColumns.includes(column.name)}
                        onCheckedChange={(checked) =>
                          setPrimaryKeyColumns((current) => toggleSelection(current, column.name, checked === true))
                        }
                        disabled={!schemaChangesEnabled || isPending}
                      />
                      <span className="font-mono">{column.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleAddPrimaryKey}
                disabled={!schemaChangesEnabled || isPending || properties.columns.length === 0}
              >
                Add primary key
              </Button>
            </>
          )}
        </Card>

        <Card className="p-4 space-y-4">
          <div>
            <h2 className="font-semibold">Quick Stats</h2>
            <p className="text-sm text-muted-foreground mt-1">
              A few useful signals before making schema changes.
            </p>
          </div>

          <div className="grid gap-3">
            <div className="rounded-lg border p-3">
              <div className="text-xs uppercase text-muted-foreground mb-1">Schema</div>
              <div className="font-mono text-sm">{properties.schema || 'default'}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs uppercase text-muted-foreground mb-1">Primary key</div>
              <div className="text-sm">
                {hasPrimaryKey ? properties.primaryKeyColumns.join(', ') : 'Not defined'}
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs uppercase text-muted-foreground mb-1">Droppable indexes</div>
              <div className="text-sm">{removableIndexes.length}</div>
            </div>
          </div>
        </Card>
      </div>

      {schemaChangesEnabled && (
        <Card className="p-4 border-destructive/20 bg-destructive/5 space-y-4">
          <div>
            <h2 className="font-semibold text-destructive">Danger Zone</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Deleting this table permanently removes its data and schema from the connected database.
            </p>
          </div>

          <Button variant="destructive" className="gap-2 w-fit" disabled={isPending} onClick={handleDeleteTable}>
            <Trash2 className="h-4 w-4" />
            Delete table
          </Button>
        </Card>
      )}
    </div>
  );
}
