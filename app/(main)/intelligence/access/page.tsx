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
        description="Manage access IDs, type configuration, and token balances for your signed-in account."
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
            Use this section to manage `intelligence_access` records with denormalized configuration for models, tokens, and prompts.
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
            <p className="font-medium text-foreground">`open`</p>
            <p>Send `accessId` and `accessKey`. Basic validation only. User passes full model config at runtime.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">`hybrid`</p>
            <p>Send `accessId`, `accessKey`, `query`, and `context`. Models are stored in access record. Fallback chain: try 1st, then 2nd, then 3rd, etc.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">`closed`</p>
            <p>Send `accessId`, `accessKey`, `query`, and `context`. Prompt and models are stored (encrypted). Fallback chain works same as hybrid.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Example POST body</p>
            <pre className="overflow-auto rounded-xl bg-muted p-3 text-xs text-foreground">{`{
  "accessId": "acc_abc123",
  "accessKey": "token-here",
  "query": "Write a short summary",
  "context": "optional context"
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
              No access records yet. Add one to create access configuration.
            </p>
          ) : (
            <div className="grid gap-4">
              {accesses.map((access) => (
                <Card key={access.id} className="border-border/70">
                  <CardHeader className="gap-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <CardTitle className="font-headline">
                          {access.key_hash.substring(0, 16)}...
                        </CardTitle>
                        <CardDescription>Access record #{access.id}</CardDescription>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">ID {access.id}</Badge>
                        <Badge variant="outline">
                          Type {access.type}
                        </Badge>
                        <Badge variant="outline">
                          Status {access.status || 'prod'}
                        </Badge>
                        <Badge variant="outline">
                          <Coins className="mr-1 h-3.5 w-3.5" />
                          Balance {access.token_balance.toFixed(6)}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
                    <div>
                      <p className="font-medium text-foreground">Type</p>
                      <p>{access.type}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {access.type === 'open' ? 'User provides model/key at runtime' : access.type === 'hybrid' ? 'Models stored, keys at runtime' : 'Prompt, models, and keys stored (encrypted)'}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Max Tokens</p>
                      <p>{access.max_tokens ?? 'Default provider limit'}</p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Key Hash</p>
                      <p className="font-mono break-all">{maskSecret(access.key_hash)}</p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Updated</p>
                      <p>{new Date(access.updated_at).toLocaleString()}</p>
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
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
