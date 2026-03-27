'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Save, Trash2 } from 'lucide-react';

import {
  deleteIntelligenceAccessAction,
  updateIntelligenceAccessAction,
  type UpdateIntelligenceAccessActionState,
} from '@/app/intelligence/actions';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface TokenOption {
  id: number;
  name: string;
}

interface ModelOption {
  id: number;
  title: string;
  provider: string;
  model: string;
}

const initialState: UpdateIntelligenceAccessActionState = {
  error: null,
  success: null,
};

export default function AccessEditForm({
  accessId,
  tokens,
  models,
  initialValues,
}: {
  accessId: number;
  tokens: TokenOption[];
  models: ModelOption[];
  initialValues: {
    accessIdentifier: string;
    balance: number;
    primaryModelId: number | null;
    fallbackModelId: number | null;
    primaryAccessKey: number | null;
    fallbackAccessKey: number | null;
    maxTokens: number | null;
    defPrompt: string | null;
    tokenHash: string;
  };
}) {
  const [state, updateAction, isPending] = useActionState(updateIntelligenceAccessAction, initialState);

  return (
    <div className="grid gap-6">
      {state.error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {state.error}
        </div>
      )}

      {state.success && (
        <div className="rounded-xl border border-emerald-300/60 bg-emerald-50/70 p-4 text-sm text-emerald-900">
          {state.success}
        </div>
      )}

      <Card className="border-primary/15 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardHeader className="space-y-3">
          <CardTitle className="text-2xl font-headline">Edit access</CardTitle>
          <CardDescription className="max-w-2xl text-base">
            Update the linked tokens, model fallbacks, and master prompt for this access record.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateAction} className="grid gap-5">
            <input type="hidden" name="access_id" value={String(accessId)} />

            <div className="grid gap-5 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Access ID</Label>
                <div className="rounded-xl border border-border/70 bg-muted/30 p-3 font-mono text-sm break-all text-muted-foreground">
                  {initialValues.accessIdentifier}
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Balance</Label>
                <div className="rounded-xl border border-border/70 bg-muted/30 p-3 text-sm text-muted-foreground">
                  {initialValues.balance}
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="primary_model_id">Primary Model</Label>
                <select
                  id="primary_model_id"
                  name="primary_model_id"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  defaultValue={initialValues.primaryModelId !== null ? String(initialValues.primaryModelId) : ''}
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
                  defaultValue={initialValues.fallbackModelId !== null ? String(initialValues.fallbackModelId) : ''}
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
                  defaultValue={initialValues.primaryAccessKey !== null ? String(initialValues.primaryAccessKey) : ''}
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
                  defaultValue={initialValues.fallbackAccessKey !== null ? String(initialValues.fallbackAccessKey) : ''}
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
                <Input
                  id="max_tokens"
                  name="max_tokens"
                  type="number"
                  min="1"
                  defaultValue={initialValues.maxTokens !== null ? String(initialValues.maxTokens) : ''}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="def_prompt">Master Prompt</Label>
              <Textarea
                id="def_prompt"
                name="def_prompt"
                defaultValue={initialValues.defPrompt || ''}
                className="min-h-40"
              />
            </div>

            <div className="grid gap-2">
              <Label>Access Token Hash</Label>
              <div className="rounded-xl border border-border/70 bg-muted/30 p-4 font-mono text-sm break-all text-muted-foreground">
                {initialValues.tokenHash}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="submit" disabled={isPending}>
                <Save className="mr-2 h-4 w-4" />
                {isPending ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button variant="outline" asChild>
                <Link href="/intelligence/access">Back to Access</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">Delete access</CardTitle>
          <CardDescription>
            This removes the access record and its logs. This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={deleteIntelligenceAccessAction} className="flex flex-col gap-3 sm:flex-row">
            <input type="hidden" name="access_id" value={String(accessId)} />
            <Button type="submit" variant="destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Access
            </Button>
            <Button variant="outline" asChild>
              <Link href="/intelligence/access">Cancel</Link>
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
