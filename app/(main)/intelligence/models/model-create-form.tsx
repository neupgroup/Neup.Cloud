'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Bot, Calculator, Flag } from 'lucide-react';

import { createIntelligenceModelAction } from '@/services/intelligence/intelligence-service';
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
import { getCurrencySuggestions,
  getProviderSuggestions,
  normalizeCurrencyInput,
  normalizeProviderInput,
  parseRateDetails,
  resolveProviderDetails,
  resolveCurrencyDetails
} from '@/app/(main)/intelligence/models/model-pricing';

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={disabled || pending}>
      {pending ? 'Saving...' : 'Save Model'}
    </Button>
  );
}

export default function ModelCreateForm() {
  const [provider, setProvider] = useState('nvidia');
  const [currency, setCurrency] = useState('USD');
  const [inputRate, setInputRate] = useState('');
  const [outputRate, setOutputRate] = useState('');
  const providerDetails = resolveProviderDetails(provider);
  const providerSuggestions = providerDetails ? [] : getProviderSuggestions(provider);
  const currencyDetails = resolveCurrencyDetails(currency);
  const currencySuggestions = currencyDetails ? [] : getCurrencySuggestions(currency);
  const inputRateDetails = parseRateDetails(inputRate);
  const outputRateDetails = parseRateDetails(outputRate);
  const canSubmit = Boolean(providerDetails && currencyDetails && inputRateDetails && outputRateDetails);

  return (
    <Card className="border-primary/15 bg-gradient-to-br from-primary/5 via-background to-background">
      <CardHeader className="space-y-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Bot className="h-6 w-6" />
        </div>
        <CardTitle className="text-2xl font-headline">
          Model registry entry
        </CardTitle>
        <CardDescription className="max-w-2xl text-base">
          Save the exact provider and model values here so prompt records can copy them without relying on manual typing.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={createIntelligenceModelAction} className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              placeholder="Gemini 2.5 Flash"
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
              placeholder="nvidia"
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
                      type="button"
                      variant="outline"
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
              placeholder="gpt-4.1-mini or gemini-2.5-flash"
              className="max-w-xl"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Fast general-purpose model for real-time assistant replies."
              className="min-h-24 max-w-3xl"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="currency">Currency</Label>
            <Input
              id="currency"
              name="currency"
              placeholder="USD"
              maxLength={3}
              value={currency}
              onChange={(event) => setCurrency(normalizeCurrencyInput(event.target.value))}
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
                      type="button"
                      variant="outline"
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
              placeholder="1.23/10000000"
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
              placeholder="4.92/10000000"
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

          <p className="text-sm text-muted-foreground">
            Save stays disabled until the currency is recognized and both input and output rates can be converted into normalized per-1000 token costs.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <SubmitButton disabled={!canSubmit} />
            <Button variant="outline" asChild>
              <Link href="/intelligence/models">Back to Models</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
