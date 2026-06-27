import { notFound, redirect } from "next/navigation";
import { PageTitle } from "@/components/page-header";
import { Users } from "lucide-react";
import DatabaseUsersClient from "./database-users-client";
import { listDatabaseUsers } from '@/services/database/database-runtime';
import { parseDatabaseRouteId, resolveSelectedServerId } from "../../route-helpers";

export default async function DatabaseUsersPage(props: { params: Promise<{ id: string }>; searchParams?: Promise<{ selectedServer?: string }> }) {
    const params = await props.params;
    const serverId = await resolveSelectedServerId(props.searchParams);

    if (!serverId) {
        redirect('/servers');
    }

    const { id } = params;
    const parsedId = parseDatabaseRouteId(id);
    if (!parsedId) notFound();
    const { engine, dbName } = parsedId;

    // Fetch users
    const users = await listDatabaseUsers(serverId, engine as 'mariadb' | 'postgres', dbName);

    return (
        <div className="grid gap-8 animate-in fade-in duration-500 pb-10">
            <PageTitle
                title={
                    <span className="flex items-center gap-2">
                        <Users className="w-8 h-8 text-primary" />
                        Database Users: {dbName}
                    </span>
                }
                description={
                    <span>
                        Manage users and access permissions for database <span className="font-mono font-semibold text-foreground">{dbName}</span> ({engine}).
                    </span>
                }
            />

            <DatabaseUsersClient users={users} dbId={id} />
        </div>
    );
}
