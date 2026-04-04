
import React from 'react';
import { cookies } from 'next/headers';
import Link from 'next/link';
import type { Metadata } from 'next';
import {
    Card,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Server } from 'lucide-react';
import { UpdateDetailsClient } from './update-details-client';

export const metadata: Metadata = {
    title: 'Update Details, Neup.Cloud',
};

// Next.js 15 App Router expects params to be a Promise
type Props = {
    params: Promise<{ id: string }>;
};

export default async function UpdateDetailsPage({ params }: Props) {
    const cookieStore = await cookies();
    const serverId = cookieStore.get('selected_server')?.value;
    const serverName = cookieStore.get('selected_server_name')?.value;

    // Resolve params promise
    const { id } = await params;
    // Decode ID if needed (though usually not needed for simple ASCII)
    const decodedId = decodeURIComponent(id);

    if (serverId) {
        return (
            <UpdateDetailsClient
                serverId={serverId}
                serverName={serverName || 'Unknown Server'}
                id={decodedId}
            />
        );
    }

    return (
        <div className="space-y-6">
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
