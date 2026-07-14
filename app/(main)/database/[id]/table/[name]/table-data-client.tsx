'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Edit2, Trash2, X } from 'lucide-react';
import { deleteTableRowAction, updateTableRowAction } from '@/services/database/management';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/core/hooks/use-toast';

type ConfirmState = {
  type: 'save' | 'delete';
  rowIndex: number;
} | null;

type TableDataClientProps = {
  connectionId: string;
  tableName: string;
  columns: string[];
  rows: Record<string, unknown>[];
};

function formatCellValue(value: unknown) {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

function parseCellValue(originalValue: unknown, value: string) {
  const trimmedValue = value.trim();

  if (originalValue === null || originalValue === undefined) {
    return trimmedValue.toUpperCase() === 'NULL' || trimmedValue === '' ? null : value;
  }

  if (typeof originalValue === 'number') {
    const parsed = Number(trimmedValue);
    return Number.isFinite(parsed) ? parsed : value;
  }

  if (typeof originalValue === 'boolean') {
    if (trimmedValue.toLowerCase() === 'true') {
      return true;
    }

    if (trimmedValue.toLowerCase() === 'false') {
      return false;
    }
  }

  if (typeof originalValue === 'object') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  return value;
}

export function TableDataClient({
  connectionId,
  tableName,
  columns,
  rows,
}: TableDataClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [draftRows, setDraftRows] = useState<Record<number, Record<string, string>>>({});
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [isPending, startTransition] = useTransition();

  const emptyColSpan = Math.max(1, columns.length + 1);
  const editingDraft = useMemo(() => {
    if (editingRowIndex === null) {
      return null;
    }

    return draftRows[editingRowIndex] || null;
  }, [draftRows, editingRowIndex]);

  function startEditing(rowIndex: number) {
    const row = rows[rowIndex];
    setEditingRowIndex(rowIndex);
    setDraftRows((current) => ({
      ...current,
      [rowIndex]: Object.fromEntries(columns.map((column) => [column, formatCellValue(row[column])])),
    }));
  }

  function updateDraftCell(rowIndex: number, column: string, value: string) {
    setDraftRows((current) => ({
      ...current,
      [rowIndex]: {
        ...(current[rowIndex] || {}),
        [column]: value,
      },
    }));
  }

  function cancelEditing() {
    setEditingRowIndex(null);
  }

  function buildUpdatedRow(rowIndex: number) {
    const originalRow = rows[rowIndex];
    const draftRow = draftRows[rowIndex] || {};

    return Object.fromEntries(
      columns.map((column) => [
        column,
        parseCellValue(originalRow[column], draftRow[column] ?? formatCellValue(originalRow[column])),
      ])
    );
  }

  function runConfirmedAction() {
    if (!confirmState) {
      return;
    }

    const actionState = confirmState;
    setConfirmState(null);

    startTransition(async () => {
      try {
        if (actionState.type === 'save') {
          await updateTableRowAction({
            connectionId,
            tableName,
            originalRow: rows[actionState.rowIndex],
            updatedRow: buildUpdatedRow(actionState.rowIndex),
          });
          setEditingRowIndex(null);
          toast({ title: 'Row saved' });
        } else {
          await deleteTableRowAction({
            connectionId,
            tableName,
            row: rows[actionState.rowIndex],
          });
          toast({ title: 'Row deleted' });
        }

        router.refresh();
      } catch (error) {
        toast({
          title: actionState.type === 'save' ? 'Update failed' : 'Delete failed',
          description: error instanceof Error ? error.message : 'Something went wrong.',
          variant: 'destructive',
        });
      }
    });
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column} className="font-mono text-xs">
                {column}
              </TableHead>
            ))}
            <TableHead className="w-[104px] text-right text-xs">Edit</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={emptyColSpan} className="text-center text-muted-foreground py-8">
                No rows found.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, rowIndex) => {
              const isEditing = editingRowIndex === rowIndex;
              const draftRow = isEditing ? editingDraft : null;

              return (
                <TableRow key={rowIndex} className="group">
                  {columns.map((column) => (
                    <TableCell key={`${rowIndex}-${column}`} className="align-top">
                      <div
                        className="max-w-[360px] break-words whitespace-pre-wrap rounded-sm text-xs font-mono outline-none focus:bg-background focus:ring-2 focus:ring-ring"
                        contentEditable={isEditing && !isPending}
                        suppressContentEditableWarning
                        onInput={(event) => updateDraftCell(rowIndex, column, event.currentTarget.innerText)}
                      >
                        {draftRow?.[column] ?? formatCellValue(row[column])}
                      </div>
                    </TableCell>
                  ))}
                  <TableCell className="align-top">
                    <div className="flex justify-end gap-1">
                      {isEditing ? (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={isPending}
                            onClick={() => setConfirmState({ type: 'save', rowIndex })}
                            title="Save row"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            disabled={isPending}
                            onClick={() => setConfirmState({ type: 'delete', rowIndex })}
                            title="Delete row"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={isPending}
                            onClick={cancelEditing}
                            title="Cancel edit"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                            disabled={isPending}
                            onClick={() => startEditing(rowIndex)}
                            title="Edit row"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
                            disabled={isPending}
                            onClick={() => setConfirmState({ type: 'delete', rowIndex })}
                            title="Delete row"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <AlertDialog open={confirmState !== null} onOpenChange={(open) => !open && setConfirmState(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmState?.type === 'save'
                ? 'Are you sure that you want to save this.'
                : 'Are you sure that you want to drop this row.'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmState?.type === 'save'
                ? 'This will update the selected row in the database.'
                : 'This will delete the selected row from the table.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              {confirmState?.type === 'save' ? 'Dont update' : 'Dont delete'}
            </AlertDialogCancel>
            <AlertDialogAction disabled={isPending} onClick={runConfirmedAction}>
              Yes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
