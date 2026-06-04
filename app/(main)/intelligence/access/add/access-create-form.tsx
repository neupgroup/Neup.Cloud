'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { Copy, KeyRound } from 'lucide-react';

import {
  createIntelligenceAccessAction,
  type CreateIntelligenceAccessActionState,
} from '@/services/intelligence/intelligence-service';
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

interface SelectableOption {
  id: number;
  label: string;
}

const initialState: CreateIntelligenceAccessActionState = {
  error: null,
  generatedAccessId: null,
  generatedToken: null,
};

function normalizeSelectionInput(value: string): string {
  return value.trim().toLowerCase();
}

function buildModelLabel(model: ModelOption): string {
  return `${model.title} (${model.provider}:${model.model})`;
}

function buildTokenLabel(token: TokenOption): string {
  return token.name;
}

function getMatchingOptionId(options: SelectableOption[], value: string): number | null {
  const normalized = normalizeSelectionInput(value);

  if (!normalized) {
    return null;
  }

  const match = options.find((option) => normalizeSelectionInput(option.label) === normalized);
  return match?.id ?? null;
}

function getFilteredOptions(options: SelectableOption[], value: string): SelectableOption[] {
  const normalized = normalizeSelectionInput(value);

  if (!normalized) {
    return options;
  }

  return options.filter((option) => normalizeSelectionInput(option.label).includes(normalized));
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
  const modelOptions = models.map((model) => ({
    id: model.id,
    label: buildModelLabel(model),
  }));
  const tokenOptions = tokens.map((token) => ({
    id: token.id,
    label: buildTokenLabel(token),
  }));
  const [primaryModelInput, setPrimaryModelInput] = useState('');
  const [fallbackModelInput, setFallbackModelInput] = useState('');
  const [primaryTokenInput, setPrimaryTokenInput] = useState('');
  const [fallbackTokenInput, setFallbackTokenInput] = useState('');

  const primaryModelId = getMatchingOptionId(modelOptions, primaryModelInput);
  const fallbackModelId = getMatchingOptionId(modelOptions, fallbackModelInput);
  const primaryTokenId = getMatchingOptionId(tokenOptions, primaryTokenInput);
  const fallbackTokenId = getMatchingOptionId(tokenOptions, fallbackTokenInput);

  const primaryModelSuggestions = primaryModelId ? [] : getFilteredOptions(modelOptions, primaryModelInput);
  const fallbackModelSuggestions = fallbackModelId ? [] : getFilteredOptions(modelOptions, fallbackModelInput);
  const primaryTokenSuggestions = primaryTokenId ? [] : getFilteredOptions(tokenOptions, primaryTokenInput);
  const fallbackTokenSuggestions = fallbackTokenId ? [] : getFilteredOptions(tokenOptions, fallbackTokenInput);

  const canSubmit =
    (!primaryModelInput || primaryModelId !== null) &&
    (!fallbackModelInput || fallbackModelId !== null) &&
    (!primaryTokenInput || primaryTokenId !== null) &&
    (!fallbackTokenInput || fallbackTokenId !== null);

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
          <CardTitle className="text-2xl font-headline">
            Prompt creation form
          </CardTitle>
          <CardDescription className="max-w-2xl text-base">
            Your signed-in account is used automatically. Access ID and access token are generated for you automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="grid gap-5">
            <input type="hidden" name="primary_model_id" value={primaryModelId !== null ? String(primaryModelId) : ''} />
            <input type="hidden" name="fallback_model_id" value={fallbackModelId !== null ? String(fallbackModelId) : ''} />
            <input type="hidden" name="primary_access_key" value={primaryTokenId !== null ? String(primaryTokenId) : ''} />
            <input type="hidden" name="fallback_access_key" value={fallbackTokenId !== null ? String(fallbackTokenId) : ''} />

            <div className="grid gap-2">
              <Label htmlFor="primary_model_input">Primary Model</Label>
              <Input
                id="primary_model_input"
                value={primaryModelInput}
                onChange={(event) => setPrimaryModelInput(event.target.value)}
                placeholder="Type or choose a primary model"
                className="max-w-2xl"
              />
              {primaryModelId !== null ? (
                <p className="text-sm text-muted-foreground">Selected model: {primaryModelInput}</p>
              ) : primaryModelInput ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    {primaryModelSuggestions.map((option) => (
                      <Button
                        key={option.id}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() => setPrimaryModelInput(option.label)}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                  <p className="text-sm text-destructive">Type an exact model label or click a chip to select one.</p>
                </>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {primaryModelSuggestions.map((option) => (
                    <Button
                      key={option.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={() => setPrimaryModelInput(option.label)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="fallback_model_input">Fallback Model</Label>
              <Input
                id="fallback_model_input"
                value={fallbackModelInput}
                onChange={(event) => setFallbackModelInput(event.target.value)}
                placeholder="Type or choose a fallback model"
                className="max-w-2xl"
              />
              {fallbackModelId !== null ? (
                <p className="text-sm text-muted-foreground">Selected model: {fallbackModelInput}</p>
              ) : fallbackModelInput ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    {fallbackModelSuggestions.map((option) => (
                      <Button
                        key={option.id}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() => setFallbackModelInput(option.label)}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                  <p className="text-sm text-destructive">Type an exact model label or click a chip to select one.</p>
                </>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {fallbackModelSuggestions.map((option) => (
                    <Button
                      key={option.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={() => setFallbackModelInput(option.label)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="primary_token_input">Primary Provider Token</Label>
              <Input
                id="primary_token_input"
                value={primaryTokenInput}
                onChange={(event) => setPrimaryTokenInput(event.target.value)}
                placeholder="Type or choose a primary token"
                className="max-w-lg"
              />
              {primaryTokenId !== null ? (
                <p className="text-sm text-muted-foreground">Selected token: {primaryTokenInput}</p>
              ) : primaryTokenInput ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    {primaryTokenSuggestions.map((option) => (
                      <Button
                        key={option.id}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() => setPrimaryTokenInput(option.label)}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                  <p className="text-sm text-destructive">Type an exact token name or click a chip to select one.</p>
                </>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {primaryTokenSuggestions.map((option) => (
                    <Button
                      key={option.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={() => setPrimaryTokenInput(option.label)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="fallback_token_input">Fallback Provider Token</Label>
              <Input
                id="fallback_token_input"
                value={fallbackTokenInput}
                onChange={(event) => setFallbackTokenInput(event.target.value)}
                placeholder="Type or choose a fallback token"
                className="max-w-lg"
              />
              {fallbackTokenId !== null ? (
                <p className="text-sm text-muted-foreground">Selected token: {fallbackTokenInput}</p>
              ) : fallbackTokenInput ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    {fallbackTokenSuggestions.map((option) => (
                      <Button
                        key={option.id}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() => setFallbackTokenInput(option.label)}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                  <p className="text-sm text-destructive">Type an exact token name or click a chip to select one.</p>
                </>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {fallbackTokenSuggestions.map((option) => (
                    <Button
                      key={option.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={() => setFallbackTokenInput(option.label)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="max_tokens">Max Tokens</Label>
              <Input id="max_tokens" name="max_tokens" type="number" min="1" placeholder="Optional" className="max-w-xs" />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="guider">Guider</Label>
              <Textarea
                id="guider"
                name="guider"
                placeholder="Fixed guider for how the model should behave..."
                className="min-h-40"
              />
            </div>

            <div className="rounded-xl border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
              Prompt balance starts at <span className="font-medium text-foreground">0.00</span> and can be recharged later from the logs recharge page.
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="submit" disabled={isPending || !canSubmit}>
                {isPending ? 'Creating Prompt...' : 'Create Prompt'}
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
