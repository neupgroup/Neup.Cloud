import { PageTitleBack } from "@/components/page-header";
import { Network, Server, ShieldCheck } from "lucide-react";
import { Metadata } from "next";
import { cookies } from 'next/headers';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import NetworkTestClient from "./test-client";

export const metadata: Metadata = {
    title: 'Test Network Firewall | Neup.Cloud',
};

export default async function NetworkTestPage() {
    const cookieStore = await cookies();
    const serverId = cookieStore.get('selected_server')?.value;

    return (
        <div className="space-y-6">
            <PageTitleBack
                backHref="/server/firewall/network"
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
                        <Link href="/servers">Go to Servers</Link>
                    </Button>
                </Card>
            ) : (
                <NetworkTestClient serverId={serverId} />
            )}
        </div>
    );
}
