'use client';

import { useActionState, useMemo, useState } from 'react';
import Link from 'next/link';
import { Copy, KeyRound, Plus, Trash2 } from 'lucide-react';

import {
  createIntelligenceAccessAction,
  type CreateIntelligenceAccessActionState,
} from '@/services/intelligence/intelligence-service';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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

interface ModelRow {
  modelInput: string;
  tokenInput: string;
}

type AccessType = 'open' | 'model_key_def' | 'prompt_def';

const accessTypeOptions: Array<{ value: AccessType; label: string; description: string }> = [
  { value: 'prompt_def', label: 'Prompt Access', description: 'Model, key, and prompt are all defined in advance.' },
  { value: 'model_key_def', label: 'Model Key Defined', description: 'Model and key are defined; the user passes prompt and context at runtime.' },
  { value: 'open', label: 'Open Access', description: 'The user passes a set of [model, key] at runtime. No prompt is stored here.' },
];

const initialState: CreateIntelligenceAccessActionState = {
  error: null,
  generatedAccessId: null,
  generatedToken: null,
};

function buildModelLabel(model: ModelOption): string {
  return `${model.title} (${model.provider}:${model.model})`;
}

function buildTokenLabel(token: TokenOption): string {
  return token.name;
}

export default function AccessCreateForm({
  tokens,
  models,
}: {
  tokens: TokenOption[];
  models: ModelOption[];
}) {
  const [state, formAction, isPending] = useActionState(createIntelligenceAccessAction, initialState);
  const [copied, setCopied] = useState(false);
  const modelOptions = useMemo(
    () =>
      models.map((model) => ({
        id: model.id,
        label: buildModelLabel(model),
      })),
    [models]
  );
  const tokenOptions = useMemo(
    () =>
      tokens.map((token) => ({
        id: token.id,
        label: buildTokenLabel(token),
      })),
    [tokens]
  );
  const [rows, setRows] = useState<ModelRow[]>([{ modelInput: '', tokenInput: '' }]);
  const [accessType, setAccessType] = useState<AccessType>('prompt_def');
  const [prompt, setPrompt] = useState('');

  const getModelLabel = (id: string) => modelOptions.find((option) => String(option.id) === id)?.label || 'Select a model';
  const getTokenLabel = (id: string) => tokenOptions.find((option) => String(option.id) === id)?.label || 'Select a token';

  const rowState = rows.map((row, index) => {
    const modelId = row.modelInput ? Number(row.modelInput) : null;
    const tokenId = row.tokenInput ? Number(row.tokenInput) : null;
    return {
      index,
      ...row,
      modelId,
      tokenId,
    };
  });

  const canSubmit = rowState.every((row) => {
    const modelValid = row.modelInput === '' || row.modelId !== null;
    const tokenValid = row.tokenInput === '' || row.tokenId !== null;
    return modelValid && tokenValid;
  });

  const setRowValue = (index: number, key: keyof ModelRow, value: string) => {
    setRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row))
    );
  };

  const addRow = () => {
    setRows((current) => [...current, { modelInput: '', tokenInput: '' }]);
  };

  const removeRow = (index: number) => {
    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  };

  const serializedEntries = rowState
    .filter((row) => row.index > 0 && (row.modelId !== null || row.tokenId !== null))
    .map((row) => ({
      modelId: row.modelId,
      keyId: row.tokenId,
      index: row.index,
      details: {
        label: row.modelInput,
        tokenLabel: row.tokenInput,
        role: row.index === 0 ? 'primary' : 'fallback',
      },
    }));

  const primaryRow = rowState[0];
  const secondaryRow = rowState[1] ?? null;

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
                <Link href="/intelligence/access">View Access</Link>
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
          <CardTitle className="text-2xl font-headline">Access creation form</CardTitle>
          <CardDescription className="max-w-2xl text-base">
            Add a primary model row and any number of additional model/key rows. The first row is stored as the primary source of truth; the rest are saved as indexed fallbacks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="grid gap-5">
            <div className="grid gap-2">
              <Label>What is the type of access you're trying to open?</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" className="justify-between">
                    <span className="truncate">
                      {accessTypeOptions.find((option) => option.value === accessType)?.label || 'Select access type'}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-96">
                  {accessTypeOptions.map((option) => (
                    <DropdownMenuItem key={option.value} onClick={() => setAccessType(option.value)}>
                      <div className="grid gap-0.5">
                        <span>{option.label}</span>
                        <span className="text-xs text-muted-foreground">{option.description}</span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <input type="hidden" name="primary_model_id" value={primaryRow?.modelId !== null ? String(primaryRow.modelId) : ''} />
            <input type="hidden" name="fallback_model_id" value={secondaryRow?.modelId != null ? String(secondaryRow.modelId) : ''} />
            <input type="hidden" name="primary_access_key" value={primaryRow?.tokenId !== null ? String(primaryRow.tokenId) : ''} />
            <input type="hidden" name="fallback_access_key" value={secondaryRow?.tokenId != null ? String(secondaryRow.tokenId) : ''} />
            <input type="hidden" name="access_type" value={accessType} />
            <input type="hidden" name="def_prompt" value={accessType === 'prompt_def' ? prompt : ''} />
            <input type="hidden" name="model_entries" value={JSON.stringify(serializedEntries)} />

            {accessType !== 'open' && (
              <div className="grid gap-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Model blocks</p>
                    <p className="text-sm text-muted-foreground">Row 1 is primary. Row 2 and beyond are saved to `intelligence_fallbacks` with an index.</p>
                  </div>
                  <Button type="button" variant="outline" onClick={addRow}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Model Block
                  </Button>
                </div>

                {rowState.map((row, index) => (
                  <div key={index} className="grid gap-4 rounded-2xl border border-border/70 bg-background p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">
                          {index === 0 ? 'Primary model block' : `Fallback block ${index}`}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {index === 0
                            ? 'This is the main source of truth.'
                            : 'This row will be persisted in the fallback index table.'}
                        </p>
                      </div>
                      {index > 0 && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeRow(index)}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove
                        </Button>
                      )}
                    </div>

                    <div className="grid gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor={`model_input_${index}`}>Model</Label>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              id={`model_input_${index}`}
                              type="button"
                              variant="outline"
                              className="justify-between"
                            >
                              <span className="truncate">{getModelLabel(row.modelInput)}</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="max-h-72 w-96 overflow-auto">
                            {modelOptions.map((option) => (
                              <DropdownMenuItem
                                key={option.id}
                                onClick={() => setRowValue(index, 'modelInput', String(option.id))}
                              >
                                {option.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor={`token_input_${index}`}>Token</Label>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              id={`token_input_${index}`}
                              type="button"
                              variant="outline"
                              className="justify-between"
                              disabled={!row.modelInput}
                            >
                              <span className="truncate">{getTokenLabel(row.tokenInput)}</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="max-h-72 w-96 overflow-auto">
                            {tokenOptions.map((option) => (
                              <DropdownMenuItem
                                key={option.id}
                                onClick={() => setRowValue(index, 'tokenInput', String(option.id))}
                              >
                                {option.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {accessType === 'prompt_def' && (
              <div className="grid gap-2">
                <Label htmlFor="prompt">Prompt</Label>
                <Textarea
                  id="prompt"
                  name="prompt"
                  className="min-h-40"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Define the prompt that will be stored with this access record."
                />
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="max_tokens">Max Tokens</Label>
              <Input id="max_tokens" name="max_tokens" type="number" min="1" placeholder="Optional" />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="submit" disabled={isPending || !canSubmit}>
                {isPending ? 'Saving...' : 'Create Access'}
              </Button>
              <Button variant="outline" asChild>
                <Link href="/intelligence/access">View Access</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
