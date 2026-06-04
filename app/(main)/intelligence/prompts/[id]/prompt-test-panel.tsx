'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type PromptTestPanelProps = {
  accountId: string;
  accessIdentifier: string;
  tokenKey: string;
  modelOptions: Array<{
    label: string;
    value: string;
  }>;
  suggestedModel: string;
};

export default function PromptTestPanel({
  accountId,
  accessIdentifier,
  tokenKey,
  modelOptions,
  suggestedModel,
}: PromptTestPanelProps) {
  const appBasePath = process.env.NEXT_PUBLIC_BASE_PATH || '/cloud';
  const [query, setQuery] = useState('who are you?');
  const [context, setContext] = useState('');
  const [model, setModel] = useState(suggestedModel);
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');
  const [isPending, setIsPending] = useState(false);

  const handleRunTest = async () => {
    setError('');
    setResponse('');

    setIsPending(true);

    try {
      console.info('[intelligence prompt test] step=client_start', {
        accountId,
        accessIdentifier,
        selectedModel: model.trim(),
      });
      const requestUrl = new URL(`${appBasePath}/bridge/api.v1/intelligence/getResponse`, window.location.origin);

      if (model.trim()) {
        requestUrl.searchParams.set('model', model.trim());
      }

      console.info('[intelligence prompt test] step=client_request', {
        url: requestUrl.toString(),
        queryLength: query.length,
        contextLength: context.length,
      });

      const res = await fetch(requestUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          userid: accountId,
          accessid: accessIdentifier,
          tokenKey,
        },
        body: JSON.stringify({
          query,
          context,
        }),
      });

      console.info('[intelligence prompt test] step=client_response', {
        ok: res.ok,
        status: res.status,
      });

      const rawText = await res.text();
      console.info('[intelligence prompt test] step=client_response_body', {
        rawTextPreview: rawText.slice(0, 300),
      });

      let payload:
        | { status: 'pass'; response: string }
        | { status: 'fail'; error: string }
        | null = null;

      try {
        payload = JSON.parse(rawText) as
          | { status: 'pass'; response: string }
          | { status: 'fail'; error: string };
      } catch (parseError) {
        console.error('[intelligence prompt test] step=client_parse_failed', parseError);
      }

      if (!res.ok || !payload || payload.status !== 'pass') {
        console.error('[intelligence prompt test] step=client_error', { payload, rawText });
        throw new Error(
          payload && payload.status === 'fail'
            ? payload.error
            : rawText.trim() || `Request failed with status ${res.status}`
        );
      }

      console.info('[intelligence prompt test] step=client_success');
      setResponse(payload.response);
    } catch (testError) {
      console.error('[intelligence prompt test] step=client_exception', testError);
      setError(testError instanceof Error ? testError.message : 'Failed to run prompt test.');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Card className="border-primary/15 bg-gradient-to-br from-primary/5 via-background to-background">
      <CardHeader className="space-y-3">
        <CardTitle className="text-2xl font-headline">Test prompt here</CardTitle>
        <CardDescription className="max-w-2xl text-base">
          Send a live request using the current access record without leaving this page.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-2">
          <Label htmlFor="test_model">Model override</Label>
          {modelOptions.length > 0 ? (
            <select
              id="test_model"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            >
              {modelOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <Input
              id="test_model"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="Optional model identifier"
            />
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="test_query">Query</Label>
          <Textarea
            id="test_query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-h-32"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="test_context">Context</Label>
          <Textarea
            id="test_context"
            value={context}
            onChange={(event) => setContext(event.target.value)}
            className="min-h-32"
            placeholder="Optional JSON or plain text context"
          />
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
      </CardContent>
    </Card>
  );
}
