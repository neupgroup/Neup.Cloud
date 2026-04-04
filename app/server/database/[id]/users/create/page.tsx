
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getDatabaseDetails } from "@/actions/database";
import { UserCreateForm } from "../user-create-form";
import { Button } from "@/components/ui/button";
import { ChevronLeft, UserPlus } from "lucide-react";
import Link from "next/link";

export default async function CreateUserPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const cookieStore = await cookies();
    const serverId = cookieStore.get('selected_server')?.value;

    if (!serverId) notFound();

    const parts = id.split('-');
    if (parts.length < 2) notFound();
    const engine = parts[0] as 'mariadb' | 'postgres';
    const dbName = parts.slice(1).join('-');

    try {
        await getDatabaseDetails(serverId, engine, dbName);
    } catch (e) {
        notFound();
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="space-y-1">
                <Button variant="ghost" className="pl-0 hover:bg-transparent text-muted-foreground hover:text-foreground" asChild>
                    <Link href={`/server/database/${id}/users`}>
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
