import type { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageTitleBack } from '@/components/page-header';
import { Server } from 'lucide-react';
import StorageClient from './storage-client';
import { getServer } from '@/services/server/server-service';

export const metadata: Metadata = {
    title: 'Storage, Neup.Cloud',
};

export default async function StoragePage({
    searchParams,
}: {
    searchParams?: Promise<{ selectedServer?: string }>;
}) {
    const resolvedSearchParams = searchParams ? await searchParams : {};
    const serverId = resolvedSearchParams.selectedServer?.trim() || null;
    const serverName = serverId ? (await getServer(serverId))?.name ?? null : null;

    if (!serverId) {
        return (
            <div className="space-y-6 animate-in fade-in duration-500">
                <PageTitleBack
                    title="Storage"
                    description="Monitor disk usage and storage allocation."
                    backHref="/server/system"
                />
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
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-5xl animate-in fade-in duration-500 pb-10">
            <PageTitleBack
                title="Storage"
                description="Monitor disk usage and storage allocation on this server."
                serverName={serverName}
                backHref="/server/system"
            />

            <StorageClient
                serverId={serverId}
            />
        </div>
    );
}
