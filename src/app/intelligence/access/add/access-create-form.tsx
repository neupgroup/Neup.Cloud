'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { Copy, KeyRound } from 'lucide-react';

import {
  createIntelligenceAccessAction,
  type CreateIntelligenceAccessActionState,
} from '@/app/intelligence/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface TokenOption {
  id: number;
  account_id: string;
  name: string;
}

interface ModelOption {
  id: number;
  title: string;
  provider: string;
  model: string;
  description: string | null;
}

const initialState: CreateIntelligenceAccessActionState = {
  error: null,
  generatedAccessId: null,
  generatedToken: null,
};

export default function AccessCreateForm({
  tokens,
  models,
}: {
  tokens: TokenOption[];
  models: ModelOption[];
}) {
  const [state, formAction, isPending] = useActionState(createIntelligenceAccessAction, initialState);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!state.generatedToken) {
      return;
    }

    await navigator.clipboard.writeText(state.generatedToken);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="grid gap-5">
      {state.generatedToken && (
        <Card className="border-emerald-300/60 bg-emerald-50/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-headline text-emerald-900">
              <KeyRound className="h-5 w-5" />
              Save This Access Token Now
            </CardTitle>
            <CardDescription className="text-emerald-800">
              The access ID and token are shown only once. Copy them now and store them safely. Only the token hash was saved to the database.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {state.generatedAccessId && (
              <div className="rounded-xl border border-emerald-300 bg-white p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Access ID</p>
                <p className="mt-1 font-mono text-sm break-all text-emerald-950">{state.generatedAccessId}</p>
              </div>
            )}
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-xl border border-emerald-300 bg-white p-4 text-left font-mono text-sm break-all text-emerald-950 transition hover:border-emerald-500 hover:bg-emerald-100"
            >
              {state.generatedToken}
            </button>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="button" onClick={handleCopy}>
                <Copy className="mr-2 h-4 w-4" />
                {copied ? 'Copied' : 'Copy Access Token'}
              </Button>
              <Button variant="outline" asChild>
                <Link href="/intelligence/access">View Access Records</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {state.error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {state.error}
        </div>
      )}

      <Card className="border-primary/15 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardHeader className="space-y-3">
          <CardTitle className="text-2xl font-headline">
            Access creation form
          </CardTitle>
          <CardDescription className="max-w-2xl text-base">
            Your signed-in account is used automatically. Access ID and access token are generated for you automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="grid gap-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="primary_model_id">Primary Model</Label>
                <select
                  id="primary_model_id"
                  name="primary_model_id"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  defaultValue=""
                >
                  <option value="">No primary model</option>
                  {models.map((model) => (
                    <option key={model.id} value={String(model.id)}>
                      {model.title} ({model.provider}:{model.model})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="fallback_model_id">Fallback Model</Label>
                <select
                  id="fallback_model_id"
                  name="fallback_model_id"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  defaultValue=""
                >
                  <option value="">No fallback model</option>
                  {models.map((model) => (
                    <option key={model.id} value={String(model.id)}>
                      {model.title} ({model.provider}:{model.model})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="primary_access_key">Primary Provider Token</Label>
                <select
                  id="primary_access_key"
                  name="primary_access_key"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  defaultValue=""
                >
                  <option value="">No primary token</option>
                  {tokens.map((token) => (
                    <option key={token.id} value={String(token.id)}>
                      {token.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="fallback_access_key">Fallback Provider Token</Label>
                <select
                  id="fallback_access_key"
                  name="fallback_access_key"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  defaultValue=""
                >
                  <option value="">No fallback token</option>
                  {tokens.map((token) => (
                    <option key={token.id} value={String(token.id)}>
                      {token.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Label htmlFor="max_tokens">Max Tokens</Label>
                <Input id="max_tokens" name="max_tokens" type="number" min="1" placeholder="Optional" />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="def_prompt">Master Prompt</Label>
              <Textarea
                id="def_prompt"
                name="def_prompt"
                placeholder="You are a helpful assistant for {{company}}..."
                className="min-h-40"
              />
            </div>

            <div className="rounded-xl border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
              Balance starts at <span className="font-medium text-foreground">0</span> and can be recharged later from the logs recharge page.
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Creating Access...' : 'Create Access'}
              </Button>
              <Button variant="outline" asChild>
                <Link href="/intelligence/models">Manage Models First</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
