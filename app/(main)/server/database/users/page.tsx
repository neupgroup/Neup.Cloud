import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/page-header";
import {
    Database,
    Plus,
    Server,
    Shield,
    User,
    Users,
    ChevronRight
} from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import {
    listAllDatabaseUserAssignments,
    listAllDatabases,
    type DatabaseInstance,
    type DatabaseUserAssignment
} from "@/services/database/database-runtime";
import { getServer } from "@/services/server/server-service";
import { withSelectedServerQuery } from "@/inapp/helpers/navigation";
import {
    buildDatabaseRouteId,
    buildDatabaseUserRouteSlug
} from "../route-paths";
import {
    resolveSelectedServerId
} from "../route-helpers";
import { cn } from "@/core/utils";

export const metadata: Metadata = {
    title: "Database Users | Neup.Cloud",
};

type Props = {
    searchParams?: Promise<{ selectedServer?: string }>;
};

function getAccessBadgeVariant(permissions: DatabaseUserAssignment["permissions"]) {
    return permissions === "full" ? "default" : "secondary";
}

export default async function ServerDatabaseUsersPage({ searchParams }: Props) {
    const serverId = await resolveSelectedServerId(searchParams);
    const serverName = serverId ? (await getServer(serverId))?.name ?? null : null;

    let databases: DatabaseInstance[] = [];
    let assignments: DatabaseUserAssignment[] = [];

    if (serverId) {
        try {
            databases = await listAllDatabases(serverId);
            assignments = await listAllDatabaseUserAssignments(serverId, databases);
        } catch (error) {
            console.error("Failed to fetch database users:", error);
        }
    }

    const uniqueUsers = new Set(assignments.map((assignment) => `${assignment.engine}:${assignment.username}:${assignment.host || "%"}`));
    const fullAccessCount = assignments.filter((assignment) => assignment.permissions === "full").length;
    const readOnlyCount = assignments.filter((assignment) => assignment.permissions === "read").length;

    return (
        <div className="grid gap-8 animate-in fade-in duration-500 pb-10">
            <PageTitle
                title="Database Users"
                description="Manage database users and role assignments across this server"
                serverName={serverName}
            />

            {!serverId ? (
                <Card className="text-center p-12 border-dashed bg-muted/20">
                    <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                        <Server className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-semibold">No Server Selected</h3>
                    <p className="mt-2 text-muted-foreground max-w-sm mx-auto">
                        You need to select a server before you can manage database users.
                    </p>
                    <Button asChild className="mt-6" variant="outline">
                        <Link href="/servers">Go to Servers</Link>
                    </Button>
                </Card>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="bg-primary/5 border-primary/10">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">User Assignments</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{assignments.length}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Unique Users</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{uniqueUsers.size}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Full Access</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{fullAccessCount}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Read Only</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{readOnlyCount}</div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-6">
                        <div>
                            <h2 className="text-2xl font-semibold font-headline tracking-tight">Assign Users</h2>
                            <p className="text-sm text-muted-foreground mt-1">
                                Choose a database to create a user or grant database access.
                            </p>
                        </div>

                        <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm">
                            {databases.length > 0 ? (
                                databases.map((database, index) => {
                                    const dbId = buildDatabaseRouteId(database.engine, database.name);

                                    return (
                                        <Link
                                            key={`${database.engine}-${database.name}`}
                                            href={withSelectedServerQuery(`/server/database/${dbId}/users/create`, serverId)}
                                            className="block group"
                                        >
                                            <div className={cn(
                                                "p-4 min-w-0 w-full transition-colors group-hover:bg-muted/50",
                                                index !== databases.length - 1 && "border-b border-border"
                                            )}>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-4 min-w-0 flex-1">
                                                        <div className="p-2 rounded-lg shrink-0 bg-primary/10 text-primary">
                                                            <Plus className="h-5 w-5" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="font-bold text-base">{database.name}</span>
                                                                <Badge variant="secondary" className="text-[10px] uppercase">{database.engine}</Badge>
                                                            </div>
                                                            <p className="text-xs text-muted-foreground">
                                                                Add a user or assign a role to this database.
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
                                                </div>
                                            </div>
                                        </Link>
                                    );
                                })
                            ) : (
                                <div className="p-8 text-center">
                                    <div className="p-3 bg-muted rounded-full mb-4 inline-flex">
                                        <Database className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                    <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                                        No databases are available on this server.
                                    </p>
                                </div>
                            )}
                        </Card>
                    </div>

                    <div className="grid gap-6">
                        <div>
                            <h2 className="text-2xl font-semibold font-headline tracking-tight">Current Assignments</h2>
                            <p className="text-sm text-muted-foreground mt-1">
                                Update roles, revoke database access, reassign owned objects, or drop users.
                            </p>
                        </div>

                        <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm">
                            {assignments.length > 0 ? (
                                assignments.map((assignment, index) => {
                                    const dbId = buildDatabaseRouteId(assignment.engine, assignment.databaseName);
                                    const userSlug = buildDatabaseUserRouteSlug(assignment.username, assignment.host || "%");

                                    return (
                                        <Link
                                            key={`${assignment.engine}-${assignment.databaseName}-${assignment.username}-${assignment.host || "%"}`}
                                            href={withSelectedServerQuery(`/server/database/${dbId}/users/${userSlug}`, serverId)}
                                            className="block group"
                                        >
                                            <div className={cn(
                                                "p-4 min-w-0 w-full transition-colors group-hover:bg-muted/50",
                                                index !== assignments.length - 1 && "border-b border-border"
                                            )}>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-4 min-w-0 flex-1">
                                                        <div className="p-2 rounded-lg shrink-0 bg-secondary text-secondary-foreground">
                                                            <User className="h-5 w-5" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                                <span className="font-mono text-sm font-semibold">{assignment.username}</span>
                                                                <Badge variant={getAccessBadgeVariant(assignment.permissions)} className="text-[10px] h-5 capitalize">
                                                                    {assignment.permissions || "custom"} Access
                                                                </Badge>
                                                                <Badge variant="outline" className="text-[10px] uppercase">{assignment.engine}</Badge>
                                                            </div>
                                                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
                                                                <span className="flex items-center gap-1.5 shrink-0">
                                                                    <Database className="h-3.5 w-3.5" />
                                                                    <span className="font-mono text-foreground">{assignment.databaseName}</span>
                                                                </span>
                                                                <span className="flex items-center gap-1.5 shrink-0">
                                                                    <Shield className="h-3.5 w-3.5" />
                                                                    Host: <span className="font-mono text-foreground">{assignment.host || "%"}</span>
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
                                                </div>
                                            </div>
                                        </Link>
                                    );
                                })
                            ) : (
                                <div className="p-8 text-center">
                                    <div className="p-3 bg-muted rounded-full mb-4 inline-flex">
                                        <Users className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                    <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                                        No database user assignments were found on this server.
                                    </p>
                                </div>
                            )}
                        </Card>
                    </div>
                </>
            )}
        </div>
    );
}
