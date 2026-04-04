import { PageTitle } from "@/components/page-header";
import { Key } from "lucide-react";
import { Metadata } from "next";
import { cookies } from 'next/headers';
import KeysList from "./keys-list";

export const metadata: Metadata = {
    title: 'SSH Keys | Firewall | Neup.Cloud',
};

export default async function KeysPage() {
    const cookieStore = await cookies();
    const serverId = cookieStore.get('selected_server')?.value;
    const serverName = cookieStore.get('selected_server_name')?.value;

    return (
        <div className="space-y-6">
            <PageTitle
                title={
                    <span className="flex items-center gap-2">
                        <Key className="h-6 w-6 text-primary" />
                        SSH Keys
                    </span>
                }
                description="Manage SSH keys for secure access"
                serverName={serverName}
            />

            <KeysList serverId={serverId} />
        </div>
    );
}

