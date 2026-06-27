import { DatabaseCreateForm } from './database-create-form';
import { PageTitleBack } from '@/components/page-header';
import { Database } from 'lucide-react';
import { checkDatabaseInstallation } from '@/services/database/database-runtime';
import { getServer } from '@/services/server/server-service';
import { withSelectedServerQuery } from '@/core/server-context';

export default async function CreateDatabasePage({
    searchParams,
}: {
    searchParams?: Promise<{ selectedServer?: string }>;
}) {
    const resolvedSearchParams = searchParams ? await searchParams : {};
    const serverId = resolvedSearchParams.selectedServer?.trim() || null;
    const serverName = serverId ? (await getServer(serverId))?.name ?? null : null;

    let installationStatus = null;
    if (serverId) {
        try {
            installationStatus = await checkDatabaseInstallation(serverId);
        } catch (error) {
            console.error("Failed to check database installation:", error);
        }
    }

    return (
        <div className="flex flex-col gap-8 max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <PageTitleBack
                title={
                    <span className="flex items-center gap-2">
                        <Database className="w-8 h-8 text-primary" />
                        Create New Database
                    </span>
                }
                description={
                    serverName ? (
                        <span>
                            Set up a new database instance on <span className="font-semibold text-foreground">{serverName}</span>
                        </span>
                    ) : (
                        "Select a server to create a database."
                    )
                }
                backHref={withSelectedServerQuery('/server/database', serverId)}
            />

            <DatabaseCreateForm serverId={serverId ?? undefined} initialInstallation={installationStatus} />
        </div>
    );
}
