import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Coins, KeyRound, Plus, ShieldCheck } from 'lucide-react';

import { PageTitle } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getCurrentIntelligenceAccountId } from '@/core/ai/files/intelligence/account';
import { getIntelligenceAccesses, maskSecret } from '@/core/ai/files/intelligence/store';

export const metadata: Metadata = {
  title: 'Intelligence Access, Neup.Cloud',
};

export default async function IntelligenceAccessPage() {
  const accesses = await getIntelligenceAccesses(await getCurrentIntelligenceAccountId());

  return (
    <div className="grid gap-8">
      <PageTitle
        title={
          <span className="flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-primary" />
            Intelligence Access
          </span>
        }
        description="Manage access IDs, primary source-of-truth prompts, linked provider tokens, and model configuration for your signed-in account."
      />

      <Card className="border-primary/15 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardHeader className="space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <KeyRound className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-headline">
            Access records live here
          </CardTitle>
          <CardDescription className="max-w-2xl text-base">
            Use this section to manage `intelligenceAccess` as the primary source of truth for prompt IDs, access IDs, access keys, model wiring, and access type.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/intelligence/access/add">Add Access</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/intelligence/tokens">View Tokens</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Endpoint Guide</CardTitle>
          <CardDescription>
            How to call `/bridge/api.v1/intelligence/getResponse` with each access type.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">`prompt_def`</p>
            <p>Send `promptId` and `accessKey`. The stored prompt, model, and key are used. Include `query` and optional `context` in the body when you want extra runtime details.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">`model_key_def`</p>
            <p>Send `promptId`, `accessKey`, `query`, and `context`. The access record defines the model and key wiring, while the request supplies the prompt text at runtime.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">`open`</p>
            <p>Send `promptId`, `accessKey`, `query`, `context`, and a `model` array. Each item should look like `&lt;provider&gt;/&lt;model&gt;@@@&lt;apiKey&gt;`.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Example POST body</p>
            <pre className="overflow-auto rounded-xl bg-muted p-3 text-xs text-foreground">{`{
  "promptId": "ACC-123",
  "accessKey": "token-here",
  "query": "Write a short summary",
  "context": "optional context",
  "model": ["openai/gpt-4o@@@sk-...", "anthropic/claude-3-5-sonnet@@@sk-..."]
}`}</pre>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-headline">
            <Plus className="h-5 w-5 text-primary" />
            Existing Access Records
          </CardTitle>
        </CardHeader>
        <CardContent>
          {accesses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No access records yet. Add one to connect models, tokens, and a generated access ID.
            </p>
          ) : (
            <div className="grid gap-4">
              {accesses.map((access) => {
                const currency = access.primaryModelConfig?.currency || access.fallbackModelConfig?.currency || 'USD';

                return (
                  <Card key={access.id} className="border-border/70">
                    <CardHeader className="gap-3">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-2">
                          <CardTitle className="font-headline">
                            {access.prompt_id}
                          </CardTitle>
                          <CardDescription>Generated access ID for this record.</CardDescription>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">ID {access.id}</Badge>
                          <Badge variant="outline">
                            <Coins className="mr-1 h-3.5 w-3.5" />
                            Balance {access.balance.toFixed(6)} {currency}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
                      <div>
                        <p className="font-medium text-foreground">Primary</p>
                        <p>{access.primaryModelConfig?.title || access.primaryModel || 'Not set'}</p>
                        <p>{access.primaryModelConfig ? `${access.primaryModelConfig.provider}:${access.primaryModelConfig.model}` : null}</p>
                        <p>{access.primaryAccessTokenName || 'No token selected'}</p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Fallback</p>
                        <p>{access.fallbackModelConfig?.title || access.fallbackModel || 'Not set'}</p>
                        <p>{access.fallbackModelConfig ? `${access.fallbackModelConfig.provider}:${access.fallbackModelConfig.model}` : null}</p>
                        <p>{access.fallbackAccessTokenName || 'No token selected'}</p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Access Token Hash</p>
                        <p className="font-mono">{maskSecret(access.token_hash)}</p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Max Tokens</p>
                        <p>{access.maxTokens ?? 'Default provider limit'}</p>
                      </div>
                      <div className="md:col-span-2">
                        <p className="font-medium text-foreground">Guider</p>
                        <p className="whitespace-pre-wrap">{access.defPrompt || 'No guider configured.'}</p>
                      </div>
                      <div className="md:col-span-2">
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <Button variant="outline" asChild>
                            <Link href={`/intelligence/access/${access.id}`}>
                              Edit Access
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                          </Button>
                          <Button variant="outline" asChild>
                            <Link href={`/intelligence/logs/recharge?accessId=${access.id}`}>
                              Recharge This Balance
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
