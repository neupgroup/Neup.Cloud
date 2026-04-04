import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { PageTitle } from "@/components/page-header";
import { Users } from "lucide-react";
import DatabaseUsersClient from "./database-users-client";
import { listDatabaseUsers } from "@/actions/database";

export default async function DatabaseUsersPage(props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const cookieStore = await cookies();
    const serverId = cookieStore.get('selected_server')?.value;

    if (!serverId) {
        redirect('/servers');
    }

    const { id } = params;

    // Parse engine and dbName from id (format: engine-dbName)
    // Find first hyphen to split
    const splitIndex = id.indexOf('-');
    if (splitIndex === -1) {
        notFound();
    }

    const engine = id.substring(0, splitIndex);
    const dbName = id.substring(splitIndex + 1);

    if (engine !== 'mariadb' && engine !== 'postgres') {
        notFound();
    }

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
