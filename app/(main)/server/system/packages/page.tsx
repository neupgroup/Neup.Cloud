
import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import {
    Card,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Server } from 'lucide-react';
import { PackagesClient } from './packages-client';
import { getServer } from '@/services/server/server-service';

export const metadata: Metadata = {
    title: 'Packages, Neup.Cloud',
};

export default async function PackagesPage({
    searchParams,
}: {
    searchParams?: Promise<{ selectedServer?: string }>;
}) {
    const resolvedSearchParams = searchParams ? await searchParams : {};
    const serverId = resolvedSearchParams.selectedServer?.trim() || null;
    const serverName = serverId ? (await getServer(serverId))?.name ?? null : null;

    if (serverId) {
        return (
            <PackagesClient
                serverId={serverId}
                serverName={serverName || 'Unknown Server'}
            />
        );
    }

    return (
        <div className="space-y-6">
            <Card className="text-center p-8">
                <div className="flex justify-center">
                    <Server className="h-12 w-12 text-muted-foreground" />
                </div>
                <h3 className="mt-4 text-lg font-medium">No Server Selected</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                    Please go to the servers page and select a server to manage.
                </p>
                <Button asChild className="mt-4">
                    <Link href="/servers">Go to Servers</Link>
                </Button>
            </Card>
        </div>
    );
}
