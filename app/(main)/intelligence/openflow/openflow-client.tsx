'use client';

import { useState } from 'react';
import { Loader2, Send, ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { invokeOpenFlowAction } from './openflow-actions';

type ProviderValue = 'openai' | 'anthropic' | 'google' | 'nvidia';

interface ModelOption {
  id: number;
  title: string;
  provider: ProviderValue;
  model: string;
}

interface Token {
  id: number;
  name: string;
  key: string;
}

interface OpenFlowClientProps {
  tokens: Token[];
  models: ModelOption[];
  accountId: string;
}

interface OpenFlowResponse {
  success: boolean;
  response?: string;
  modelUsed?: string;
  provider?: string;
  error?: string;
  fallbackUsed?: boolean;
}

export function OpenFlowClient({ tokens, models, accountId }: OpenFlowClientProps) {
  const providerOptions = Array.from(new Set(models.map((item) => item.provider))) as ProviderValue[];

  function getModelsForProvider(selectedProvider: ProviderValue) {
    return models.filter((item) => item.provider === selectedProvider);
  }

  const [provider, setProvider] = useState<ProviderValue>(providerOptions[0] || 'openai');
  const [model, setModel] = useState(getModelsForProvider(providerOptions[0] || 'openai')[0]?.model || '');
  const [selectedSavedKey, setSelectedSavedKey] = useState('');
  const [useCustomKey, setUseCustomKey] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [fallbackProvider, setFallbackProvider] = useState<ProviderValue>(providerOptions[1] || providerOptions[0] || 'anthropic');
  const [fallbackModel, setFallbackModel] = useState(getModelsForProvider(providerOptions[1] || providerOptions[0] || 'anthropic')[0]?.model || '');
  const [fallbackApiKey, setFallbackApiKey] = useState('');
  const [useFallback, setUseFallback] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [context, setContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<OpenFlowResponse | null>(null);
  const [showFallback, setShowFallback] = useState(false);

  function handleProviderChange(nextProvider: ProviderValue) {
    setProvider(nextProvider);
    const firstModelForProvider = models.find((item) => item.provider === nextProvider);
    setModel(firstModelForProvider?.model || '');
  }

  function handleFallbackProviderChange(nextProvider: ProviderValue) {
    setFallbackProvider(nextProvider);
    const firstModelForProvider = getModelsForProvider(nextProvider)[0];
    setFallbackModel(firstModelForProvider?.model || '');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!apiKey || !prompt) {
      return;
    }

    setLoading(true);
    setResponse(null);

    try {
      const result = await invokeOpenFlowAction({
        provider,
        model,
        apiKey,
        fallbackProvider: useFallback ? fallbackProvider : null,
        fallbackModel: useFallback ? fallbackModel : null,
        fallbackApiKey: useFallback ? fallbackApiKey : null,
        prompt,
        context,
        accountId,
      });
      setResponse(result);
    } catch (error) {
      setResponse({
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Configure Request</CardTitle>
          <CardDescription>Select provider, model, and API key before sending your prompt and context</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-6">
            <div className="grid gap-2">
              <Label htmlFor="provider">Provider</Label>
              <Select value={provider} onValueChange={(value) => handleProviderChange(value as ProviderValue)}>
                <SelectTrigger id="provider">
                  <SelectValue placeholder="Choose a provider..." />
                </SelectTrigger>
                <SelectContent>
                  {providerOptions.length > 0 ? (
                    providerOptions.map((providerOption) => (
                      <SelectItem key={providerOption} value={providerOption}>
                        {providerOption === 'openai'
                          ? 'OpenAI'
                          : providerOption === 'anthropic'
                            ? 'Anthropic'
                            : providerOption === 'google'
                              ? 'Google'
                              : 'NVIDIA'}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="openai" disabled>
                      No providers available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="model">Model</Label>
              <Select value={model} onValueChange={setModel} disabled={getModelsForProvider(provider).length === 0}>
                <SelectTrigger id="model">
                  <SelectValue placeholder="Choose a model..." />
                </SelectTrigger>
                <SelectContent>
                  {getModelsForProvider(provider).length > 0 ? (
                    getModelsForProvider(provider).map((modelOption) => (
                      <SelectItem key={modelOption.id} value={modelOption.model}>
                        {modelOption.title}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-models" disabled>
                      No models available for this provider
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="apiKey">API Key</Label>
              {!useCustomKey ? (
                <Select
                  value={selectedSavedKey}
                  onValueChange={(value) => {
                    setSelectedSavedKey(value);
                    const token = tokens.find((item) => item.id.toString() === value);
                    setApiKey(token?.key || '');
                  }}
                >
                  <SelectTrigger id="saved-key">
                    <SelectValue placeholder="Choose a saved key" />
                  </SelectTrigger>
                  <SelectContent>
                    {tokens.length > 0 ? (
                      tokens.map((token) => (
                        <SelectItem key={token.id} value={token.id.toString()}>
                          {token.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-saved-keys" disabled>
                        No saved keys available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="apiKey"
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  required
                />
              )}

              <div className="flex items-center gap-2 pt-1">
                <Checkbox
                  id="use-custom-key"
                  checked={useCustomKey}
                  onCheckedChange={(checked) => {
                    const next = checked === true;
                    setUseCustomKey(next);
                    if (next) {
                      setSelectedSavedKey('');
                      setApiKey('');
                    } else {
                      setApiKey('');
                    }
                  }}
                />
                <Label htmlFor="use-custom-key" className="text-sm font-normal">
                  Use custom
                </Label>
              </div>
            </div>

            {!showFallback ? (
              <Button type="button" variant="outline" className="w-full" onClick={() => setShowFallback(true)}>
                Add fallback model
              </Button>
            ) : (
              <Collapsible open={showFallback} onOpenChange={setShowFallback}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span>Fallback Configuration</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${showFallback ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4 space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="fallback-provider">Fallback Provider</Label>
                    <Select value={fallbackProvider} onValueChange={(value) => handleFallbackProviderChange(value as ProviderValue)}>
                      <SelectTrigger id="fallback-provider">
                        <SelectValue placeholder="Choose fallback provider..." />
                      </SelectTrigger>
                      <SelectContent>
                        {providerOptions.length > 0 ? (
                          providerOptions.map((providerOption) => (
                            <SelectItem key={providerOption} value={providerOption}>
                              {providerOption === 'openai'
                                ? 'OpenAI'
                                : providerOption === 'anthropic'
                                  ? 'Anthropic'
                                  : providerOption === 'google'
                                    ? 'Google'
                                    : 'NVIDIA'}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="openai" disabled>
                            No providers available
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="fallback-model">Fallback Model</Label>
                    <Select value={fallbackModel} onValueChange={setFallbackModel} disabled={getModelsForProvider(fallbackProvider).length === 0}>
                      <SelectTrigger id="fallback-model">
                        <SelectValue placeholder="Choose fallback model..." />
                      </SelectTrigger>
                      <SelectContent>
                        {getModelsForProvider(fallbackProvider).length > 0 ? (
                          getModelsForProvider(fallbackProvider).map((modelOption) => (
                            <SelectItem key={modelOption.id} value={modelOption.model}>
                              {modelOption.title}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-models" disabled>
                            No models available for this provider
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="fallback-api-key">Fallback API Key</Label>
                    <Input
                      id="fallback-api-key"
                      placeholder="sk-..."
                      value={fallbackApiKey}
                      onChange={(e) => setFallbackApiKey(e.target.value)}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            <div className="grid gap-2">
              <Label htmlFor="prompt">Prompt *</Label>
              <Textarea
                id="prompt"
                placeholder="Enter your prompt here..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                required
                rows={4}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="context">Context (Optional)</Label>
              <Textarea
                id="context"
                placeholder="Provide additional context for the AI..."
                value={context}
                onChange={(e) => setContext(e.target.value)}
                rows={4}
              />
            </div>

            <Button type="submit" disabled={!apiKey || !prompt || loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Generate Response
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {response && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>Response</CardTitle>
                <CardDescription>
                  {response.success ? (
                    <>
                      Model: <span className="font-mono font-semibold">{response.provider}:{response.modelUsed}</span>
                      {response.fallbackUsed && (
                        <span className="ml-2 text-xs font-semibold text-yellow-600 dark:text-yellow-500">
                          (Fallback)
                        </span>
                      )}
                    </>
                  ) : (
                    'Error'
                  )}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {response.success ? (
              <div className="prose prose-sm max-w-none rounded-lg bg-muted p-4 dark:prose-invert">
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{response.response}</p>
              </div>
            ) : (
              <div className="rounded-lg bg-destructive/10 p-4">
                <p className="text-sm font-semibold text-destructive">{response.error}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
