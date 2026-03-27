import type { Metadata } from 'next';
import Link from 'next/link';
import {
  BatteryCharging,
  Bot,
  KeyRound,
  KeySquare,
  CreditCard,
  Radar,
  ScrollText,
  Sparkles,
} from 'lucide-react';

import { PageTitle } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Intelligence, Neup.Cloud',
};

const intelligenceCards = [
  {
    title: 'Home',
    description: 'Your main intelligence landing page for site-wide context, summaries, and future assistant workflows.',
    icon: Sparkles,
    href: '/intelligence',
  },
  {
    title: 'Billing',
    description: 'A separate intelligence view for billing insights, summaries, and finance-related guidance.',
    icon: CreditCard,
    href: '/intelligence/billing',
  },
  {
    title: 'Access',
    description: 'Manage intelligence access records, balances, primary models, fallback models, and prompt bindings.',
    icon: KeyRound,
    href: '/intelligence/access',
  },
  {
    title: 'Tokens',
    description: 'Manage the provider tokens used by primary and fallback model calls.',
    icon: KeySquare,
    href: '/intelligence/tokens',
  },
  {
    title: 'Models',
    description: 'Maintain a reusable catalog of supported provider models, descriptions, and pricing JSON.',
    icon: Bot,
    href: '/intelligence/models',
  },
  {
    title: 'Logs',
    description: 'Inspect intelligence request history, responses, and balance activity.',
    icon: ScrollText,
    href: '/intelligence/logs',
  },
  {
    title: 'Recharge',
    description: 'Prepare future balance top-ups and recharge flows for intelligence usage.',
    icon: BatteryCharging,
    href: '/intelligence/logs/recharge',
  },
  {
    title: 'Signal First',
    description: 'Keep high-level insights separate from low-level server actions so it is easier to focus on what matters.',
    icon: Radar,
    href: '/intelligence',
  },
];

export default function IntelligencePage() {
  return (
    <div className="grid gap-8">
      <div className="space-y-4">
        <Badge variant="secondary" className="w-fit">
          Always on
        </Badge>
        <PageTitle
          title={
            <span className="flex items-center gap-3">
              <Sparkles className="h-8 w-8 text-primary" />
              Intelligence
            </span>
          }
          description="A site-wide space for insights and ideas that does not depend on any selected server."
        />
      </div>

      <Card className="border-primary/15 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardHeader className="space-y-3">
          <CardTitle className="text-2xl font-headline">
            A dedicated place for non-server intelligence
          </CardTitle>
          <CardDescription className="max-w-2xl text-base">
            This route is intentionally separate from server operations. It is available at all times and can be expanded later with recommendations, research notes, summaries, or AI-powered helpers.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/">Back to Dashboard</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/servers">View Servers</Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {intelligenceCards.map(({ title, description, icon: Icon, href }) => (
          <Link key={title} href={href} className="block h-full">
            <Card className="h-full transition-colors hover:border-primary/40 hover:bg-primary/5">
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <CardTitle className="font-headline">{title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
