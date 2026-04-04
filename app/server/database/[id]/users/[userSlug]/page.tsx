
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getDatabaseDetails } from "@/actions/database";
import { UserManageClient } from "./user-manage-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: 'Manage Database User | Neup.Cloud',
};

type Props = {
    params: Promise<{ id: string, userSlug: string }>
}

export default async function ManageUserPage({ params }: Props) {
    const { id, userSlug } = await params;
    const cookieStore = await cookies();
    const serverId = cookieStore.get('selected_server')?.value;

    if (!serverId) notFound();

    // Parse DB ID: Format is "engine-name"
    const dbParts = id.split('-');
    if (dbParts.length < 2) notFound();
    const engine = dbParts[0] as 'mariadb' | 'postgres';
    const dbName = dbParts.slice(1).join('-');

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
