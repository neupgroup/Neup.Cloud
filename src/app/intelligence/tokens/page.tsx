import type { Metadata } from 'next';
import Link from 'next/link';
import { Coins, KeySquare, ShieldEllipsis } from 'lucide-react';

import { createAccessTokenAction } from '@/app/intelligence/actions';
import { PageTitle } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getCurrentIntelligenceAccountId } from '@/lib/intelligence/account';
import { getAccessTokens, maskSecret } from '@/lib/intelligence/store';

export const metadata: Metadata = {
  title: 'Intelligence Tokens, Neup.Cloud',
};

export default async function IntelligenceTokensPage() {
  const tokens = await getAccessTokens(await getCurrentIntelligenceAccountId());

  return (
    <div className="grid gap-8">
      <PageTitle
        title={
          <span className="flex items-center gap-3">
            <KeySquare className="h-8 w-8 text-primary" />
            Intelligence Tokens
          </span>
        }
        description="A placeholder area for access tokens that power primary and fallback model requests."
      />

      <Card className="border-primary/15 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardHeader className="space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Coins className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-headline">
            Token inventory belongs here
          </CardTitle>
          <CardDescription className="max-w-2xl text-base">
            This page manages the provider API keys used by your primary and fallback models.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createAccessTokenAction} className="grid gap-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="name">Token Name</Label>
                <Input id="name" name="name" placeholder="OpenAI Primary" required />
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Label htmlFor="key">Token Key</Label>
                <Input id="key" name="key" placeholder="provider-api-key" required />
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="submit">Add Token</Button>
              <Button variant="outline" asChild>
                <Link href="/intelligence/access/add">Create Access</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-headline">
            <ShieldEllipsis className="h-5 w-5 text-primary" />
            Placeholder
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tokens.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No access tokens yet. Add one above so access records can call model providers.
            </p>
          ) : (
            <div className="grid gap-3">
              {tokens.map((token) => (
                <div key={token.id} className="rounded-xl border border-border/70 p-4">
                  <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-medium text-foreground">{token.name}</p>
                    </div>
                    <p className="text-sm font-mono text-muted-foreground">
                      {maskSecret(token.key)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
