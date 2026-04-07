import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageTitle } from '@/components/page-header';
import { getServer } from '@/app/servers/actions';
import { Server } from 'lucide-react';
import SwapperClient from './swapper-client';

export const metadata: Metadata = {
    title: 'Swapper, Neup.Cloud',
};

function getSwapSizeFromDetails(moreDetails?: string | null) {
    if (!moreDetails) return 2048;

    try {
        const parsed = JSON.parse(moreDetails) as { swapSizeMb?: unknown; swapSize?: unknown };
        if (typeof parsed.swapSizeMb === 'number' && Number.isFinite(parsed.swapSizeMb)) {
            return Math.max(1, Math.floor(parsed.swapSizeMb));
        }

        if (typeof parsed.swapSize === 'string' && parsed.swapSize.trim()) {
            const legacyMatch = parsed.swapSize.trim().toUpperCase().match(/^(\d+)([MGT])$/);
            if (legacyMatch) {
                const amount = Number(legacyMatch[1]);
                const unit = legacyMatch[2];

                if (unit === 'M') return Math.max(1, amount);
                if (unit === 'G') return Math.max(1, amount * 1024);
                return Math.max(1, Math.ceil(amount / 1024));
            }
        }
    } catch {
        const parsed = Number(moreDetails.trim());
        if (Number.isFinite(parsed) && parsed > 0) {
            return Math.floor(parsed);
        }
    }

    return 2048;
}

export default async function SwapperPage() {
    const cookieStore = await cookies();
    const serverId = cookieStore.get('selected_server')?.value;
    const serverName = cookieStore.get('selected_server_name')?.value;

    if (!serverId) {
        return (
            <div className="space-y-6">
                <PageTitle
                    title="Swapper"
                    description="Manage the shared swap size used for command execution."
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

    const server = await getServer(serverId);
    const currentSwapSize = getSwapSizeFromDetails(server?.moreDetails);

    return (
        <div className="space-y-6 max-w-3xl">
            <PageTitle
                title="Swapper"
                description="Define the swap space size that command execution will use for this server."
                serverName={serverName}
            />

            <Card>
                <CardHeader>
                    <CardTitle>Swap Configuration</CardTitle>
                    <CardDescription>
                        The value below is stored in the server record and reused by all remote commands.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <SwapperClient
                        serverId={serverId}
                        initialSwapSize={currentSwapSize}
                        initialMoreDetails={server?.moreDetails || ''}
                    />
                </CardContent>
            </Card>
        </div>
    );
}