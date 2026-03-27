import type { Metadata } from 'next';
import Link from 'next/link';
import { BatteryCharging, Coins, WalletCards } from 'lucide-react';

import { rechargeIntelligenceBalanceAction } from '@/app/intelligence/actions';
import { PageTitleBack } from '@/components/page-header';
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
import { getIntelligenceAccesses } from '@/lib/intelligence/store';

export const metadata: Metadata = {
  title: 'Recharge Intelligence Logs, Neup.Cloud',
};

export default async function IntelligenceLogsRechargePage({
  searchParams,
}: {
  searchParams?: Promise<{ accessId?: string }>;
}) {
  const accesses = await getIntelligenceAccesses(await getCurrentIntelligenceAccountId());
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const initialAccessId = resolvedSearchParams?.accessId || '';

  return (
    <div className="grid gap-8">
      <PageTitleBack
        title={
          <span className="flex items-center gap-3">
            <BatteryCharging className="h-8 w-8 text-primary" />
            Recharge Intelligence Balance
          </span>
        }
        description="A placeholder route for future balance top-ups and recharge actions."
        backHref="/intelligence/logs"
      />

      <Card className="border-primary/15 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardHeader className="space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <WalletCards className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-headline">
            Recharge flow will live here
          </CardTitle>
          <CardDescription className="max-w-2xl text-base">
            Recharge balances for your signed-in account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={rechargeIntelligenceBalanceAction} className="grid gap-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="access_id">Access Record</Label>
                <select
                  id="access_id"
                  name="access_id"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  defaultValue={initialAccessId}
                  required
                >
                  <option value="" disabled>Select an access record</option>
                  {accesses.map((access) => (
                    <option key={access.id} value={String(access.id)}>
                      {access.prompt_id} - balance {access.balance}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="amount">Recharge Amount</Label>
                <Input id="amount" name="amount" type="number" min="1" defaultValue="1000" required />
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="submit">Recharge Balance</Button>
              <Button variant="outline" asChild>
                <Link href="/intelligence/access">View Access Records</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-headline">
            <Coins className="h-5 w-5 text-primary" />
            Placeholder
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Recharges update the access balance directly. Request logs are still only created after model responses finish.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
