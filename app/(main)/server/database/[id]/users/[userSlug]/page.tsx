
import { notFound } from "next/navigation";
import { getDatabaseDetails, listDatabaseUsers } from '@/services/database/database-runtime';
import { UserManageClient } from "./user-manage-client";
import type { Metadata } from "next";
import { parseDatabaseRouteId, resolveSelectedServerId } from "../../../route-helpers";

export const metadata: Metadata = {
    title: 'Manage Database User | Neup.Cloud',
};

type Props = {
    params: Promise<{ id: string, userSlug: string }>
    searchParams?: Promise<{ selectedServer?: string }>;
}

function decodeUserSlugPart(value: string) {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

export default async function ManageUserPage({ params, searchParams }: Props) {
    const { id, userSlug } = await params;
    const serverId = await resolveSelectedServerId(searchParams);

    if (!serverId) notFound();

    const parsedId = parseDatabaseRouteId(id);
    if (!parsedId) notFound();
    const { engine, dbName } = parsedId;

    const [encodedUsername, encodedHost] = userSlug.split('--');
    if (!encodedUsername) notFound();
    const username = decodeUserSlugPart(encodedUsername);
    const host = encodedHost ? decodeUserSlugPart(encodedHost) : '%';
    let permissions: 'full' | 'read' | 'custom' = 'custom';

    try {
        // Verify database exists
        await getDatabaseDetails(serverId, engine, dbName);
        const users = await listDatabaseUsers(serverId, engine, dbName);
        const user = users.find((entry) => entry.username === username && (entry.host || '%') === host);
        if (!user) notFound();
        permissions = user.permissions || 'custom';
    } catch (e) {
        notFound();
    }

    return (
        <UserManageClient
            serverId={serverId}
            engine={engine}
            dbName={dbName}
            username={username}
            host={host}
            initialPermissions={permissions}
        />
    );
}
