'use client';

import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type PromptTestPanelProps = {
  requestUrl: string;
  initialPromptId: string;
  initialAccessKey: string;
  initialContext: string;
};

export function PromptTestPanel({
  requestUrl,
  initialPromptId,
  initialAccessKey,
  initialContext,
}: PromptTestPanelProps) {
  const [context, setContext] = useState(initialContext);
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');
  const [isPending, setIsPending] = useState(false);
  const query = 'who are you?';

  const requestBody = useMemo(
    () =>
      JSON.stringify(
        {
          promptId: initialPromptId,
          accessKey: initialAccessKey,
          context,
          query,
        },
        null,
        2
      ),
    [context, initialAccessKey, initialPromptId]
  );

  const handleRunTest = async () => {
    setError('');
    setResponse('');
    setIsPending(true);

    try {
      const res = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: requestBody,
      });

      const rawText = await res.text();

      let payload:
        | { status: 'pass'; response: string }
        | { status: 'fail'; error: string }
        | null = null;

      try {
        payload = JSON.parse(rawText) as
          | { status: 'pass'; response: string }
          | { status: 'fail'; error: string };
      } catch {
        payload = null;
      }

      if (!res.ok || !payload || payload.status !== 'pass') {
        throw new Error(
          payload && payload.status === 'fail'
            ? payload.error
            : rawText.trim() || `Request failed with status ${res.status}`
        );
      }

      setResponse(payload.response);
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : 'Failed to run prompt test.');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <Label htmlFor="test_context">Context</Label>
        <Textarea
          id="test_context"
          value={context}
          onChange={(event) => setContext(event.target.value)}
          className="min-h-28"
          placeholder="Optional JSON or plain text context"
        />
      </div>

      <div className="grid gap-2">
        <Label>Example Curl</Label>
        <pre className="overflow-x-auto rounded-xl border border-border/70 bg-muted/30 p-4 text-sm whitespace-pre-wrap">
          {`curl "${requestUrl}" \\\n  -X POST \\\n  -H "Content-Type: application/json" \\\n  -d '${requestBody}'`}
        </pre>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="button" onClick={handleRunTest} disabled={isPending}>
          {isPending ? 'Running...' : 'Run test'}
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {response && (
        <div className="grid gap-2">
          <Label>Response</Label>
          <pre className="overflow-x-auto rounded-xl border border-border/70 bg-muted/30 p-4 text-sm whitespace-pre-wrap">
            {response}
          </pre>
        </div>
      )}
    </div>
  );
}
