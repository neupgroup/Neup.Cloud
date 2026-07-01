/*
::neup.documentation::server-firewall-network-test-page

Server-rendered firewall connectivity test page that resolves the selected
server from the URL query and preserves that context in back navigation.

::end
*/

import { PageTitleBack } from "@/components/page-header";
import { Server, ShieldCheck } from "lucide-react";
import { Metadata } from "next";
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import NetworkTestClient from "./test-client";
import { withSelectedServerQuery } from "@/core/server-context";

export const metadata: Metadata = {
    title: 'Test Network Firewall | Neup.Cloud',
};

export default async function NetworkTestPage({
    searchParams,
}: {
    searchParams?: Promise<{ selectedServer?: string }>;
}) {
    const resolvedSearchParams = searchParams ? await searchParams : {};
    const serverId = resolvedSearchParams.selectedServer?.trim() || null;

    return (
        <div className="space-y-6">
            <PageTitleBack
                backHref={withSelectedServerQuery("/server/firewall/network", serverId)}
                title={
                    <span className="flex items-center gap-2">
                        <ShieldCheck className="h-6 w-6 text-primary" />
                        Firewall Connectivity Test
                    </span>
                }
            />

            {!serverId ? (
                <Card className="text-center p-8">
                    <Server className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-medium">No Server Selected</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Please go to the servers page and select a server to manage.
                    </p>
                    <Button asChild className="mt-4">
                        <Link href="/server/list">Go to Servers</Link>
                    </Button>
                </Card>
            ) : (
                <NetworkTestClient serverId={serverId} />
            )}
        </div>
    );
}
