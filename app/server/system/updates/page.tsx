
import React from 'react';
import { cookies } from 'next/headers';
import Link from 'next/link';
import type { Metadata } from 'next';
import {
    Card,
    CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Server } from 'lucide-react';
import { PageTitle } from '@/components/page-header';
import { UpdatesClient } from './updates-client';

export const metadata: Metadata = {
    title: 'Updates, Neup.Cloud',
};

export default async function UpdatesPage() {
    const cookieStore = await cookies();
    const serverId = cookieStore.get('selected_server')?.value;
    const serverName = cookieStore.get('selected_server_name')?.value;

    if (serverId) {
        return (
            <UpdatesClient
                serverId={serverId}
                serverName={serverName || 'Unknown Server'}
            />
        );
    }

    return (
        <div className="space-y-6">
            <PageTitle
                title="System Updates"
                description="Select a server to view and install updates"
            />

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
