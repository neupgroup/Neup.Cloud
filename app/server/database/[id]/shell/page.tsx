
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getDatabaseDetails } from "@/actions/database";
import type { Metadata } from 'next';
import { ShellClient } from "./shell-client";

export const metadata: Metadata = {
    title: 'SQL Shell | Neup.Cloud',
};

type Props = {
    params: Promise<{ id: string }>
}

export default async function DatabaseShellPage({ params }: Props) {
    const { id } = await params;
    const cookieStore = await cookies();
    const serverId = cookieStore.get('selected_server')?.value;

    if (!serverId) notFound();

    // Parse ID: Format is "engine-name"
    const parts = id.split('-');
    if (parts.length < 2) notFound();

    const engine = parts[0] as 'mariadb' | 'postgres';
    const dbName = parts.slice(1).join('-');

    let details = null;
    try {
        details = await getDatabaseDetails(serverId, engine, dbName);
    } catch (error) {
        console.error(error);
        notFound();
    }

    return <ShellClient id={id} dbName={details.name} engine={details.engine} serverId={serverId} />;
}
