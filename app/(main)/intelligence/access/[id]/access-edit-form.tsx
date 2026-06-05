'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { Save, Trash2, Lock, Unlock } from 'lucide-react';

import {
  deleteIntelligenceAccessAction,
  updateIntelligenceAccessAction,
  type UpdateIntelligenceAccessActionState,
} from '@/services/intelligence/intelligence-service';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
    accessId: number;
    keyHash: string;
    type: string;
    availableTo: unknown;
    details: unknown;
    maxTokens: number | null;
    tokenBalance: number;
    status: string;
  };
}) {
  const [state, updateAction, isPending] = useActionState(updateIntelligenceAccessAction, initialState);
  const [accessType, setAccessType] = useState(initialValues.type);
  const [rows, setRows] = useState<{ modelInput: string; tokenInput: string }[]>(
    initialValues.details && Array.isArray(initialValues.details) ? initialValues.details : []
  );

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
          <CardTitle className="text-2xl font-headline">
            {accessType === 'open' ? (
              <span className="flex items-center gap-2">
                <Unlock className="h-5 w-5 text-primary" />
                Edit Open Access
              </span>
            ) : accessType === 'hybrid' ? (
              <span className="flex items-center gap-2">
                <Unlock className="h-5 w-5 text-primary" />
                Edit Hybrid Access
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                Edit Closed Access
              </span>
            )}
          </CardTitle>
          <CardDescription className="max-w-2xl text-base">
            {accessType === 'open' && 'Configure open access with no stored configuration.'}
            {accessType === 'hybrid' && 'Configure hybrid access with models stored and keys provided at runtime.'}
            {accessType === 'closed' && 'Configure closed access with encrypted prompt, models, and keys.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateAction} className="grid gap-5">
            <input type="hidden" name="access_id" value={String(accessId)} />
            <input type="hidden" name="access_type" value={accessType} />

            <div className="grid gap-5 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Access ID</Label>
                <div className="rounded-xl border border-border/70 bg-muted/30 p-3 font-mono text-sm break-all text-muted-foreground">
                  {initialValues.keyHash.substring(0, 16)}...
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Token Balance</Label>
                <div className="rounded-xl border border-border/70 bg-muted/30 p-3 text-sm text-muted-foreground">
                  {initialValues.tokenBalance.toFixed(6)}
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="access_status">Status</Label>
                <select
                  id="access_status"
                  name="access_status"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  defaultValue={initialValues.status}
                  onChange={(e) => setAccessType(e.target.value)}
                >
                  <option value="prod">Production</option>
                  <option value="dev">Development</option>
                  <option value="hold">Hold</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="max_tokens">Max Tokens</Label>
                <Input
                  id="max_tokens"
                  name="max_tokens"
                  type="number"
                  min="1"
                  defaultValue={initialValues.maxTokens ?? ''}
                  placeholder="Optional"
                />
              </div>
            </div>

            {(accessType === 'hybrid' || accessType === 'closed') && (
              <div className="grid gap-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Model blocks</p>
                    <p className="text-sm text-muted-foreground">Configure models for this access record.</p>
                  </div>
                </div>

                {rows.map((row, index) => (
                  <div key={index} className="grid gap-4 rounded-2xl border border-border/70 bg-background p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">
                          {index === 0 ? 'Primary model block' : `Fallback block ${index}`}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor={`model_${index}_id`}>Model</Label>
                        <select
                          id={`model_${index}_id`}
                          name={`model_${index}_id`}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                          defaultValue={row.modelInput}
                        >
                          <option value="">Select a model</option>
                          {models.map((model) => (
                            <option key={model.id} value={String(model.id)}>
                              {model.title} ({model.provider}:{model.model})
                            </option>
                          ))}
                        </select>
                      </div>

                      {accessType === 'closed' && (
                        <div className="grid gap-2">
                          <Label htmlFor={`token_${index}_id`}>Token (for encryption)</Label>
                          <select
                            id={`token_${index}_id`}
                            name={`token_${index}_id`}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                            defaultValue={row.tokenInput}
                          >
                            <option value="">Select a token</option>
                            {tokens.map((token) => (
                              <option key={token.id} value={String(token.id)}>
                                {token.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {accessType === 'closed' && (
              <div className="grid gap-2">
                <Label htmlFor="prompt">Prompt (stored encrypted)</Label>
                <Textarea
                  id="prompt"
                  name="def_prompt"
                  className="min-h-40"
                  placeholder="Enter prompt to be encrypted and stored"
                />
              </div>
            )}

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
