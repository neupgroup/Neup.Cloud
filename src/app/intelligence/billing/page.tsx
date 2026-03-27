import type { Metadata } from 'next';
import Link from 'next/link';
import { CreditCard, ReceiptText, Sparkles } from 'lucide-react';

import { PageTitle } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Intelligence Billing, Neup.Cloud',
};

export default function IntelligenceBillingPage() {
  return (
    <div className="grid gap-8">
      <PageTitle
        title={
          <span className="flex items-center gap-3">
            <CreditCard className="h-8 w-8 text-primary" />
            Intelligence Billing
          </span>
        }
        description="A placeholder area for billing-focused insights, summaries, and future financial intelligence."
      />

      <Card className="border-primary/15 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardHeader className="space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ReceiptText className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-headline">
            Billing intelligence lives here
          </CardTitle>
          <CardDescription className="max-w-2xl text-base">
            Use this page later for invoice summaries, spending breakdowns, account-level billing notes, or cost recommendations.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/intelligence">Back to Intelligence Home</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/intelligence/logs">Go to Logs</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-headline">
            <Sparkles className="h-5 w-5 text-primary" />
            Placeholder
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No billing intelligence content is connected yet, but the route is ready to use.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
