import type { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageTitleBack } from '@/components/page-header';
import { getServer } from '@/services/server/server-service';
import { Server } from 'lucide-react';
import SwapperClient from './swapper-client';
import { getRecurringSwapSize, listSwapFiles } from '@/services/server/system-swap';

export const metadata: Metadata = {
    title: 'Swapper, Neup.Cloud',
};

function getSwapSizeFromDetails(moreDetails?: string | null) {
    if (!moreDetails) return 2048;

    try {
        const parsed = JSON.parse(moreDetails) as { swapSizeMb?: unknown; swapSize?: unknown };
        if (typeof parsed.swapSizeMb === 'number' && Number.isFinite(parsed.swapSizeMb)) {
            return Math.max(0, Math.floor(parsed.swapSizeMb));
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
        if (Number.isFinite(parsed) && parsed >= 0) return Math.floor(parsed);
    }

    return 2048;
}

export default async function SwapperPage({
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
                    title="Swapper"
                    description="Manage swap space for this server."
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

    const [server, recurringSwap, swapFiles] = await Promise.all([
        getServer(serverId),
        getRecurringSwapSize(serverId),
        listSwapFiles(serverId),
    ]);
    const currentSwapSize = getSwapSizeFromDetails(server?.moreDetails);

    return (
        <div className="space-y-8 max-w-5xl animate-in fade-in duration-500 pb-10">
            <PageTitleBack
                title="Swapper"
                description="Configure swap space for command execution and persistent system swap."
                serverName={serverName}
                backHref="/server/system"
            />

            <SwapperClient
                serverId={serverId}
                initialSwapSize={currentSwapSize}
                initialMoreDetails={server?.moreDetails || ''}
                initialRecurringSwapMb={recurringSwap.sizeMb}
                initialSwapFiles={swapFiles.files}
            />
        </div>
    );
}
