
import { notFound } from "next/navigation";
import { getDatabaseDetails } from '@/services/database/database-runtime';
import { UserCreateForm } from "../user-create-form";
import { Button } from "@/components/ui/button";
import { ChevronLeft, UserPlus } from "lucide-react";
import Link from "next/link";
import { withSelectedServerQuery } from "@/core/server-context";
import { parseDatabaseRouteId, resolveSelectedServerId } from "../../../route-helpers";

export default async function CreateUserPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ selectedServer?: string }> }) {
    const { id } = await params;
    const serverId = await resolveSelectedServerId(searchParams);

    if (!serverId) notFound();

    const parsedId = parseDatabaseRouteId(id);
    if (!parsedId) notFound();
    const { engine, dbName } = parsedId;

    try {
        await getDatabaseDetails(serverId, engine, dbName);
    } catch (e) {
        notFound();
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="space-y-1">
                <Button variant="ghost" className="pl-0 hover:bg-transparent text-muted-foreground hover:text-foreground" asChild>
                    <Link href={withSelectedServerQuery(`/server/database/${id}/users`, serverId)}>
                        <ChevronLeft className="h-4 w-4 mr-1" /> Back to Users
                    </Link>
                </Button>
                <h1 className="text-3xl font-bold tracking-tight">Create Database User</h1>
                <p className="text-muted-foreground">Add a new authenticated account for <span className="font-medium text-foreground">{dbName}</span></p>
            </div>

            <div className="max-w-2xl">
                <UserCreateForm
                    serverId={serverId}
                    engine={engine}
                    dbName={dbName}
                />
            </div>
        </div>
    );
}
