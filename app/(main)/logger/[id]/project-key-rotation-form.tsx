'use client';

import { useState, useTransition } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@neup/components/ui/button';
import { rotateLoggerProjectIngestKeyAction } from '@/services/logger/logger-service';

// Opens a warning dialog and rotates the key after explicit confirmation.
export function ProjectKeyRotationForm({ projectId }: { projectId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <Button
        htmlType="button"
        variant="plain"
        size="icon"
        aria-label="Rotate ingest key"
        className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
        onClick={() => setIsOpen(true)}
      >
        <RefreshCw />
      </Button>
      {isOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsOpen(false); }}>
          <section role="alertdialog" aria-modal="true" aria-labelledby="rotate-key-title" aria-describedby="rotate-key-warning" className="grid w-full max-w-lg gap-4 rounded-lg border bg-background p-6 shadow-xl">
            <div className="grid gap-2">
              <h2 id="rotate-key-title" className="text-lg font-semibold">Rotate ingest key?</h2>
              <p id="rotate-key-warning" className="text-sm text-muted-foreground">
                The current key will stop working immediately. Update the environment values in every application using this project or those applications will no longer be able to send logs.
              </p>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button htmlType="button" variant="outlined" disabled={isPending} onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button
                htmlType="button"
                variant="solid"
                convey="danger"
                className="!bg-danger !text-danger-foreground hover:!bg-danger-hover active:!bg-danger-press"
                disabled={isPending}
                onClick={() => startTransition(async () => {
                  await rotateLoggerProjectIngestKeyAction(projectId);
                })}
              >
                {isPending ? 'Rotating…' : 'Rotate key'}
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
