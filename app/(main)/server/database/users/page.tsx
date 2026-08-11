import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/page-header";
import {
    Database,
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

type GroupedDatabaseUser = {
    engine: DatabaseUserAssignment["engine"];
    username: string;
    host: string;
    assignments: DatabaseUserAssignment[];
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

    const groupedUsers = Array.from(assignments.reduce((groups, assignment) => {
        const host = assignment.host || "%";
        const key = `${assignment.engine}:${assignment.username}:${host}`;
        const existing = groups.get(key);

        if (existing) {
            existing.assignments.push(assignment);
        } else {
            groups.set(key, {
                engine: assignment.engine,
                username: assignment.username,
                host,
                assignments: [assignment]
            });
        }

        return groups;
    }, new Map<string, GroupedDatabaseUser>()).values()).map((group) => ({
        ...group,
        assignments: group.assignments.sort((a, b) => a.databaseName.localeCompare(b.databaseName))
    })).sort((a, b) => a.username.localeCompare(b.username));

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
                                <div className="text-2xl font-bold">{groupedUsers.length}</div>
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
                            <h2 className="text-2xl font-semibold font-headline tracking-tight">Current Assignments</h2>
                            <p className="text-sm text-muted-foreground mt-1">
                                Update roles, revoke database access, reassign owned objects, or drop users.
                            </p>
                        </div>

                        {groupedUsers.length > 0 ? (
                            <div className="grid gap-0">
                                {groupedUsers.map((group, index) => (
                                    <Card
                                        key={`${group.engine}-${group.username}-${group.host}`}
                                        className={cn(
                                            "min-w-0 w-full rounded-none border bg-card text-card-foreground shadow-none",
                                            index > 0 && "-mt-px",
                                            index === 0 && "rounded-t-lg",
                                            index === groupedUsers.length - 1 && "rounded-b-lg"
                                        )}
                                    >
                                        <CardContent className="p-4">
                                            <div className="flex items-start gap-4 min-w-0">
                                                <div className="p-2 rounded-lg shrink-0 bg-secondary text-secondary-foreground">
                                                    <User className="h-5 w-5" />
                                                </div>
                                                <div className="min-w-0 flex-1 space-y-3">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="font-mono text-sm font-semibold">{group.username}</span>
                                                        <Badge variant="outline" className="text-[10px] uppercase">{group.engine}</Badge>
                                                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                            <Shield className="h-3.5 w-3.5" />
                                                            Host: <span className="font-mono text-foreground">{group.host}</span>
                                                        </span>
                                                    </div>

                                                    <div className="flex flex-wrap gap-2">
                                                        {group.assignments.map((assignment) => {
                                                            const dbId = buildDatabaseRouteId(assignment.engine, assignment.databaseName);
                                                            const userSlug = buildDatabaseUserRouteSlug(assignment.username, assignment.host || "%");

                                                            return (
                                                                <Link
                                                                    key={`${assignment.engine}-${assignment.databaseName}-${assignment.username}-${assignment.host || "%"}`}
                                                                    href={withSelectedServerQuery(`/server/database/${dbId}/users/${userSlug}`, serverId)}
                                                                    className={cn(
                                                                        "group/database inline-flex min-h-9 max-w-full items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs transition-colors hover:bg-muted",
                                                                        assignment.permissions === "full" && "border-primary/20 bg-primary/5"
                                                                    )}
                                                                >
                                                                    <Database className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover/database:text-foreground" />
                                                                    <span className="font-mono text-foreground truncate">{assignment.databaseName}</span>
                                                                    <Badge variant={getAccessBadgeVariant(assignment.permissions)} className="h-5 shrink-0 text-[10px] capitalize">
                                                                        {assignment.permissions || "custom"}
                                                                    </Badge>
                                                                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover/database:text-foreground" />
                                                                </Link>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                            ) : (
                                <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm">
                                    <div className="p-8 text-center">
                                    <div className="p-3 bg-muted rounded-full mb-4 inline-flex">
                                        <Users className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                    <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                                        No database user assignments were found on this server.
                                    </p>
                                    </div>
                                </Card>
                            )}
                    </div>
                </>
            )}
        </div>
    );
}
