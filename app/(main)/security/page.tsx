import type { Metadata } from 'next';
import Link from 'next/link';

import { Card } from '#/components/ui/card';
import { Button } from '#/components/ui/button';
import { PageTitle } from '@/components/page-header';

export const metadata: Metadata = {
  title: 'Security, Neup.Cloud',
};

export default function SecurityPage() {
  return (
    <div className="space-y-6">
      <PageTitle
        title="Security"
        description="Manage security controls and protection settings"
      />

      <Card className="p-6">
        <h2 className="text-lg font-semibold">DDoS Protection</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Configure traffic filtering and protection policies.
        </p>
        <Button asChild className="mt-4">
          <Link href="/security/ddos">Open DDoS Settings</Link>
        </Button>
      </Card>
    </div>
  );
}
