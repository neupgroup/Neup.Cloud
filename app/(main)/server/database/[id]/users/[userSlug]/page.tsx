
import { notFound } from "next/navigation";
import { getDatabaseDetails } from '@/services/database/database-runtime';
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

export default async function ManageUserPage({ params, searchParams }: Props) {
    const { id, userSlug } = await params;
    const serverId = await resolveSelectedServerId(searchParams);

    if (!serverId) notFound();

    const parsedId = parseDatabaseRouteId(id);
    if (!parsedId) notFound();
    const { engine, dbName } = parsedId;

    // Parse User Slug: Format is "username-host"
    const userParts = userSlug.split('-');
    if (userParts.length < 1) notFound();
    const username = userParts[0];
    const host = userParts.length > 1 ? userParts[1] : '%';

    try {
        // Verify database exists
        await getDatabaseDetails(serverId, engine, dbName);
    } catch (e) {
        notFound();
    }

    return (
        <UserManageClient
            serverId={serverId}
            engine={engine}
            dbName={dbName}
            username={username}
            host={host === 'local' ? 'localhost' : host}
        />
    );
}
