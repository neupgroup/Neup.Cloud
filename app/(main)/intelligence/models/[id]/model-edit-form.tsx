'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { Calculator, Flag, Save, Trash2 } from 'lucide-react';

import {
  deleteIntelligenceModelAction,
  updateIntelligenceModelAction,
  type UpdateIntelligenceModelActionState,
} from '@/services/intelligence/intelligence-service';
import { Button } from '#/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card';
import { Input } from '#/components/ui/input';
import { Label } from '#/components/ui/label';
import { Textarea } from '#/components/ui/textarea';
import { getCurrencySuggestions,
  getProviderSuggestions,
  normalizeCurrencyInput,
  normalizeProviderInput,
  parseRateDetails,
  resolveProviderDetails,
  resolveCurrencyDetails,
} from '@/app/(main)/intelligence/models/model-pricing';

const initialState: UpdateIntelligenceModelActionState = {
  error: null,
  success: null,
};

export default function ModelEditForm({
  modelId,
  initialValues,
}: {
  modelId: number;
  initialValues: {
    title: string;
    provider: string;
    model: string;
    description: string | null;
    currency: string;
    inputRate: string;
    outputRate: string;
    inputCostPer1000Tokens: number;
    outputCostPer1000Tokens: number;
  };
}) {
  const [state, updateAction, isPending] = useActionState(updateIntelligenceModelAction, initialState);
  const [provider, setProvider] = useState(initialValues.provider);
  const [currency, setCurrency] = useState(initialValues.currency);
  const [inputRate, setInputRate] = useState(initialValues.inputRate);
  const [outputRate, setOutputRate] = useState(initialValues.outputRate);
  const providerDetails = resolveProviderDetails(provider);
  const providerSuggestions = providerDetails ? [] : getProviderSuggestions(provider);
  const currencyDetails = resolveCurrencyDetails(currency);
  const currencySuggestions = currencyDetails ? [] : getCurrencySuggestions(currency);
  const inputRateDetails = parseRateDetails(inputRate);
  const outputRateDetails = parseRateDetails(outputRate);
  const canSubmit = Boolean(providerDetails && currencyDetails && inputRateDetails && outputRateDetails);

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
          <CardTitle className="text-2xl font-headline">Edit model</CardTitle>
          <CardDescription className="max-w-2xl text-base">
            Update the provider, model name, description, and input/output pricing rates. Existing prompt records keep their own copied snapshot.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateAction} className="grid gap-5">
            <input type="hidden" name="model_id" value={String(modelId)} />

            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                name="title"
                defaultValue={initialValues.title}
                className="max-w-xl"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="provider">Provider</Label>
              <Input
                id="provider"
                name="provider"
                value={provider}
                onChange={(event) => setProvider(normalizeProviderInput(event.target.value))}
                placeholder="openai"
                required
                className="max-w-sm"
              />
              {providerDetails ? (
                <p className="text-sm text-muted-foreground">
                  Selected provider: {providerDetails.label}
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    {providerSuggestions.map((option) => (
                      <Button
                        key={option.value}
                        htmlType="button"
                        type="outlined"
                        size="sm"
                        className="rounded-full"
                        onClick={() => setProvider(option.value)}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                  <p className="text-sm text-destructive">
                    Type an exact provider or click a chip to select one.
                  </p>
                </>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                name="model"
                defaultValue={initialValues.model}
                className="max-w-xl"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={initialValues.description || ''}
                className="min-h-24 max-w-3xl"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                name="currency"
                value={currency}
                onChange={(event) => setCurrency(normalizeCurrencyInput(event.target.value))}
                maxLength={3}
                className="max-w-[180px]"
                required
              />
              {currencyDetails ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Flag className="h-4 w-4 text-primary" />
                  <span>{currencyDetails.caption} ({currencyDetails.code})</span>
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    {currencySuggestions.map((option) => (
                      <Button
                        key={option.code}
                        htmlType="button"
                        type="outlined"
                        size="sm"
                        className="rounded-full"
                        onClick={() => setCurrency(option.code)}
                      >
                        {option.code}
                      </Button>
                    ))}
                  </div>
                  <p className="text-sm text-destructive">
                    Type an exact currency code like USD or click a chip to select one.
                  </p>
                </>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="input_rate">Input Rate</Label>
              <Input
                id="input_rate"
                name="input_rate"
                value={inputRate}
                onChange={(event) => setInputRate(event.target.value)}
                className="max-w-sm"
                required
              />
              {inputRateDetails ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calculator className="h-4 w-4 text-primary" />
                  <span>
                    Normalized input cost per 1000 tokens: {inputRateDetails.costPer1000Tokens.toFixed(12)} {currencyDetails?.code || normalizeCurrencyInput(currency) || 'CUR'}
                  </span>
                </p>
              ) : (
                <p className="text-sm text-destructive">
                  Enter a valid input rate like 1.23/10000000 or a direct per-1000 value.
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="output_rate">Output Rate</Label>
              <Input
                id="output_rate"
                name="output_rate"
                value={outputRate}
                onChange={(event) => setOutputRate(event.target.value)}
                className="max-w-sm"
                required
              />
              {outputRateDetails ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calculator className="h-4 w-4 text-primary" />
                  <span>
                    Normalized output cost per 1000 tokens: {outputRateDetails.costPer1000Tokens.toFixed(12)} {currencyDetails?.code || normalizeCurrencyInput(currency) || 'CUR'}
                  </span>
                </p>
              ) : (
                <p className="text-sm text-destructive">
                  Enter a valid output rate like 4.92/10000000 or a direct per-1000 value.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button htmlType="submit" disabled={isPending || !canSubmit}>
                <Save className="mr-2 h-4 w-4" />
                {isPending ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button type="outlined" asChild>
                <Link href="/intelligence/models">Back to Models</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">Delete model</CardTitle>
          <CardDescription>
            This removes the registry entry. Existing prompt records keep their copied model snapshot.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={deleteIntelligenceModelAction} className="flex flex-col gap-3 sm:flex-row">
            <input type="hidden" name="model_id" value={String(modelId)} />
            <Button htmlType="submit" type="solid">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Model
            </Button>
            <Button type="outlined" asChild>
              <Link href="/intelligence/models">Cancel</Link>
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
