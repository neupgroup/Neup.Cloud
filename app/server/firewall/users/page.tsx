import { PageTitle } from "@/components/page-header";
import { Users } from "lucide-react";
import { Metadata } from "next";
import { cookies } from 'next/headers';
import { getSystemUsers } from "./actions";
import UsersList from "./users-list";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
    title: 'Users | Firewall | Neup.Cloud',
};

export default async function UsersPage() {
    const cookieStore = await cookies();
    const serverId = cookieStore.get('selected_server')?.value;
    const serverName = cookieStore.get('selected_server_name')?.value;

    if (!serverId) {
        return (
            <div className="space-y-6">
                <PageTitle title="Instance Users" description="Manage system accounts" serverName={serverName} />
                <Card className="text-center p-8">
                    <CardHeader>
                        <CardTitle>No Server Selected</CardTitle>
                    </CardHeader>
                    <p className="text-muted-foreground mb-4">Please select a server to manage users.</p>
                    <Button asChild>
                        <Link href="/servers">Go to Servers</Link>
                    </Button>
                </Card>
            </div>
        );
    }

    const { users, error } = await getSystemUsers(serverId);

    return (
        <div className="space-y-6">
            <PageTitle
                title={
                    <span className="flex items-center gap-2">
                        <Users className="h-6 w-6 text-primary" />
                        Instance Users
                    </span>
                }
                description="Manage system accounts and user access for this instance"
                serverName={serverName}
            />

            {error ? (
                <Card className="p-8 text-center text-destructive border-destructive/50">
                    <p>Error loading users: {error}</p>
                </Card>
            ) : (
                <UsersList users={users || []} isLoading={false} />
            )}
        </div>
    );
}
