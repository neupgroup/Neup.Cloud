import { PageTitle } from "@/components/page-header";
import { ShieldAlert } from "lucide-react";
import { Metadata } from "next";

import { cookies } from "next/headers";

export const metadata: Metadata = {
    title: 'Firewall | Neup.Cloud',
};

export default async function FirewallPage() {
    const cookieStore = await cookies();
    const serverName = cookieStore.get('selected_server_name')?.value;

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
                    <a href="/server/firewall/network" className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2 mt-4">
                        Manage Network
                    </a>
                </div>

                <div className="p-4 border rounded-lg bg-card text-card-foreground shadow-sm">
                    <h3 className="text-lg font-semibold">Instance Users</h3>
                    <p className="text-sm text-muted-foreground mt-2">
                        Manage system accounts and user access for this instance.
                    </p>
                    <a href="/server/firewall/users" className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2 mt-4">
                        Manage Users
                    </a>
                </div>

                <div className="p-4 border rounded-lg bg-card text-card-foreground shadow-sm">
                    <h3 className="text-lg font-semibold">SSH Keys</h3>
                    <p className="text-sm text-muted-foreground mt-2">
                        Manage SSH keys for secure access to your instance.
                    </p>
                    <a href="/server/firewall/keys" className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2 mt-4">
                        Manage Keys
                    </a>
                </div>
            </div>
        </div>
    );
}
