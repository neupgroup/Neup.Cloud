
import { notFound } from "next/navigation";
import { getDatabaseDetails } from '@/services/database/database-runtime';
import type { Metadata } from 'next';
import { ShellClient } from "./shell-client";
import { parseDatabaseRouteId, resolveSelectedServerId } from "../../route-helpers";

export const metadata: Metadata = {
    title: 'SQL Shell | Neup.Cloud',
};

type Props = {
    params: Promise<{ id: string }>
    searchParams?: Promise<{ selectedServer?: string }>;
}

export default async function DatabaseShellPage({ params, searchParams }: Props) {
    const { id } = await params;
    const serverId = await resolveSelectedServerId(searchParams);

    if (!serverId) notFound();

    const parsedId = parseDatabaseRouteId(id);
    if (!parsedId) notFound();
    const { engine, dbName } = parsedId;

    let details = null;
    try {
        details = await getDatabaseDetails(serverId, engine, dbName);
    } catch (error) {
        console.error(error);
        notFound();
    }

    return <ShellClient id={id} dbName={details.name} engine={details.engine} serverId={serverId} />;
}
