/*
::neup.documentation::server-firewall-network-page

Server-rendered firewall network page that resolves the selected server from
the URL query and passes it to the interactive network rules client.

::end
*/

import { PageTitleBack } from "@/components/page-header";
import { Network, Server } from "lucide-react";
import { Metadata } from "next";
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import NetworkClient from "./network-client";
import { getServer } from "@/services/server/server-service";
import { withSelectedServerQuery } from "@/core/server-context";

export const metadata: Metadata = {
    title: 'Network Rules | Firewall | Neup.Cloud',
};

export default async function NetworkRulesPage({
    searchParams,
}: {
    searchParams?: Promise<{ selectedServer?: string }>;
}) {
    const resolvedSearchParams = searchParams ? await searchParams : {};
    const serverId = resolvedSearchParams.selectedServer?.trim() || null;
    const serverName = serverId ? (await getServer(serverId))?.name ?? null : null;

    return (
        <div className="space-y-6">
            <PageTitleBack
                backHref={withSelectedServerQuery("/server/firewall", serverId)}
                title={
                    <span className="flex items-center gap-2">
                        <Network className="h-6 w-6 text-primary" />
                        Network Details
                    </span>
                }
                description="Manage individual port access and firewall policies"
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
                        <Link href="/server/list">Go to Servers</Link>
                    </Button>
                </Card>
            ) : (
                <NetworkClient serverId={serverId} />
            )}
        </div>
    );
}
