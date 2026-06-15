import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

import {
  Card,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Server } from 'lucide-react';
import StartupClient from './startup-client';
import { PageTitle } from '@/components/page-header';
import { getServer } from '@/services/server/server-service';

export const metadata: Metadata = {
  title: 'Startup Programs, Neup.Cloud',
};

export default async function StartupPage({
  searchParams,
}: {
  searchParams?: Promise<{ selectedServer?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const serverId = resolvedSearchParams.selectedServer?.trim() || null;
  const serverName = serverId ? (await getServer(serverId))?.name ?? null : null;

  return (
    <div className="space-y-6">
      <PageTitle
        title="Startup Programs"
        description="View and manage system startup scripts"
        serverName={serverName}
      />

      {!serverId ? (
        <Card className="text-center p-8">
          <Server className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium">No Server Selected</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Please go to the servers page and select a server to manage.
          </p>
          <Button asChild className="mt-4">
            <Link href="/servers">Go to Servers</Link>
          </Button>
        </Card>
      ) : (
        <Suspense fallback={<div>Loading startup programs...</div>}>
          <StartupClient serverId={serverId} />
        </Suspense>
      )}
    </div>
  );
}
