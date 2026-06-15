import { PageTitle } from "@/components/page-header";
import { ShieldAlert } from "lucide-react";
import { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getServer } from "@/services/server/server-service";

export const metadata: Metadata = {
    title: 'Firewall | Neup.Cloud',
};

export default async function FirewallPage({
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
                title={
                    <span className="flex items-center gap-2">
                        <ShieldAlert className="h-6 w-6 text-primary" />
                        Firewall
                    </span>
                }
                description="Manage your server's network security and access rules"
                serverName={serverName}
            />

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="p-4 border rounded-lg bg-card text-card-foreground shadow-sm">
                    <h3 className="text-lg font-semibold">Network Rules</h3>
                    <p className="text-sm text-muted-foreground mt-2">
                        View and manage allowed ports and network connections.
                    </p>
                    <Button asChild className="mt-4">
                        <Link href="/server/firewall/network">Manage Network</Link>
                    </Button>
                </div>

                <div className="p-4 border rounded-lg bg-card text-card-foreground shadow-sm">
                    <h3 className="text-lg font-semibold">Instance Users</h3>
                    <p className="text-sm text-muted-foreground mt-2">
                        Manage system accounts and user access for this instance.
                    </p>
                    <Button asChild className="mt-4">
                        <Link href="/server/firewall/users">Manage Users</Link>
                    </Button>
                </div>

                <div className="p-4 border rounded-lg bg-card text-card-foreground shadow-sm">
                    <h3 className="text-lg font-semibold">SSH Keys</h3>
                    <p className="text-sm text-muted-foreground mt-2">
                        Manage SSH keys for secure access to your instance.
                    </p>
                    <Button asChild className="mt-4">
                        <Link href="/server/firewall/keys">Manage Keys</Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
