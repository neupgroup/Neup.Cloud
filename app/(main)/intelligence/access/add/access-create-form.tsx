'use client';

import { useActionState, useState } from 'react';
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

type AccessType = 'open' | 'hybrid' | 'closed';
type AccessStatus = 'dev' | 'prod' | 'hold';

const accessTypeOptions: Array<{ value: AccessType; label: string; description: string }> = [
  { value: 'open', label: 'Open Access', description: 'User provides model/key at runtime. No stored configuration.' },
  { value: 'hybrid', label: 'Hybrid Access', description: 'Models are stored. Keys provided at runtime. Prompt optional.' },
  { value: 'closed', label: 'Closed Access', description: 'Prompt, models, and keys are stored (encrypted).' },
];

const accessStatusOptions: Array<{ value: AccessStatus; label: string; description: string }> = [
  { value: 'prod', label: 'Production', description: 'No logging, standard behavior.' },
  { value: 'dev', label: 'Development', description: 'Logs requests, responses, and errors.' },
  { value: 'hold', label: 'Hold', description: 'Requests are rejected with an error.' },
];

const initialState: CreateIntelligenceAccessActionState = {
  error: null,
  generatedAccessId: null,
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
  const modelOptions = models.map((model) => ({
    id: model.id,
    label: buildModelLabel(model),
  }));
  const tokenOptions = tokens.map((token) => ({
    id: token.id,
    label: buildTokenLabel(token),
  }));
  const [rows, setRows] = useState<ModelRow[]>([{ modelInput: '', tokenInput: '' }]);
  const [accessType, setAccessType] = useState<AccessType>('open');
  const [accessStatus, setAccessStatus] = useState<AccessStatus>('prod');
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

  const primaryRow = rowState[0];
  const secondaryRow = rowState[1] ?? null;

  return (
    <div className="grid gap-5">
      {state.error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {state.error}
        </div>
      )}

      <Card className="border-primary/15 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardHeader className="space-y-3">
          <CardTitle className="text-2xl font-headline">Access creation form</CardTitle>
          <CardDescription className="max-w-2xl text-base">
            Configure access type, models, and tokens. For 'closed' access, models and keys will be encrypted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="grid gap-5">
            <input type="hidden" name="primary_model_id" value={primaryRow?.modelId !== null ? String(primaryRow.modelId) : ''} />
            <input type="hidden" name="fallback_model_id" value={secondaryRow?.modelId != null ? String(secondaryRow.modelId) : ''} />
            <input type="hidden" name="primary_access_key" value={primaryRow?.tokenId !== null ? String(primaryRow.tokenId) : ''} />
            <input type="hidden" name="fallback_access_key" value={secondaryRow?.tokenId != null ? String(secondaryRow.tokenId) : ''} />
            <input type="hidden" name="access_type" value={accessType} />
            <input type="hidden" name="access_status" value={accessStatus} />
            <input type="hidden" name="def_prompt" value={accessType === 'closed' ? prompt : ''} />

            <div className="grid gap-2">
              <Label>What type of access are you creating?</Label>
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

            <div className="grid gap-2">
              <Label>Access status</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" className="justify-between">
                    <span className="truncate">
                      {accessStatusOptions.find((option) => option.value === accessStatus)?.label || 'Select status'}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-96">
                  {accessStatusOptions.map((option) => (
                    <DropdownMenuItem key={option.value} onClick={() => setAccessStatus(option.value)}>
                      <div className="grid gap-0.5">
                        <span>{option.label}</span>
                        <span className="text-xs text-muted-foreground">{option.description}</span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {(accessType === 'hybrid' || accessType === 'closed') && (
              <div className="grid gap-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Model blocks</p>
                    <p className="text-sm text-muted-foreground">Row 1 is primary. Row 2 and beyond are fallbacks.</p>
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
                            : 'This row will be used as fallback if primary fails.'}
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

                      {(accessType === 'closed') && (
                        <div className="grid gap-2">
                          <Label htmlFor={`token_input_${index}`}>Token (for encryption)</Label>
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
                  name="prompt"
                  className="min-h-40"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Define the prompt that will be encrypted and stored with this access record."
                />
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="max_tokens">Max Tokens (optional)</Label>
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
