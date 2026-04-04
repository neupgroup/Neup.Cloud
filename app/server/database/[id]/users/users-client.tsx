
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Database, User, ShieldCheck, Trash2, Key, Globe, LayoutGrid, ChevronLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from '@/hooks/use-toast';
import { UserCreateForm } from "./user-create-form";
import { deleteDatabaseUser, type DatabaseUser } from "@/actions/database";
import Link from 'next/link';

interface UsersClientPageProps {
    serverId: string;
    engine: 'mariadb' | 'postgres';
    dbName: string;
    initialUsers: DatabaseUser[];
}

export function UsersClientPage({ serverId, engine, dbName, initialUsers }: UsersClientPageProps) {
    const router = useRouter();
    const { toast } = useToast();
    const [isDeleting, setIsDeleting] = useState<string | null>(null);

    const handleSuccess = () => {
        router.refresh();
    };

    const handleDelete = async (username: string, host: string) => {
        if (!confirm(`Are you sure you want to delete user ${username}?`)) return;

        setIsDeleting(`${username}-${host}`);
        try {
            const res = await deleteDatabaseUser(serverId, engine, dbName, username, host);
            if (res.success) {
                toast({ title: 'User deleted', description: res.message });
                router.refresh();
            } else {
                toast({ variant: 'destructive', title: 'Error', description: res.message });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setIsDeleting(null);
        }
    };

    return (
        <div className="grid gap-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <Button variant="ghost" className="pl-0 hover:bg-transparent text-muted-foreground hover:text-foreground" asChild>
                        <Link href={`/server/database/${engine}-${dbName}`}>
                            <ChevronLeft className="h-4 w-4 mr-1" /> Back to Database
                        </Link>
                    </Button>
                    <h1 className="text-3xl font-bold tracking-tight">Database Users</h1>
                    <p className="text-muted-foreground">Manage access for <span className="text-foreground font-medium">{dbName}</span></p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-2 border-primary/5">
                        <CardHeader className="bg-muted/10">
                            <CardTitle className="flex items-center gap-2">
                                <User className="h-5 w-5 text-primary" />
                                Authorized Users
                            </CardTitle>
                            <CardDescription>Users currently permitted to access this database instance</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            {initialUsers.length > 0 ? (
                                <div className="divide-y border-t">
                                    {initialUsers.map((user, idx) => (
                                        <div key={`${user.username}-${user.host}-${idx}`} className="p-4 flex items-center justify-between hover:bg-muted/5 transition-colors group">
                                            <div className="flex items-center gap-4">
                                                <div className="p-2.5 bg-primary/5 rounded-xl group-hover:bg-primary/10 transition-colors">
                                                    <User className="h-5 w-5 text-primary" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-lg">{user.username}</span>
                                                        <Badge variant="outline" className="text-[10px] uppercase border-primary/20 text-primary">
                                                            {user.host || 'Remote Access'}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                                        <span className="flex items-center gap-1">
                                                            <ShieldCheck className={`h-3 w-3 ${user.permissions === 'full' ? 'text-primary' : 'text-amber-500'}`} />
                                                            {user.permissions === 'full' ? 'Full Privileges' : user.permissions === 'read' ? 'Read Only' : 'Custom Permissions'}
                                                        </span>
                                                        <span className="flex items-center gap-1"><Globe className="h-3 w-3" /> External Auth</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary" asChild>
                                                    <Link href={`/server/database/${engine}-${dbName}/users/${user.username}-${user.host || 'local'}`}>
                                                        <Key className="h-4 w-4" />
                                                    </Link>
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-muted-foreground hover:text-destructive"
                                                    onClick={() => handleDelete(user.username, user.host || '%')}
                                                    disabled={isDeleting === `${user.username}-${user.host}`}
                                                >
                                                    {isDeleting === `${user.username}-${user.host}` ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="h-4 w-4" />
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 px-4">
                                    <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4 text-muted-foreground">
                                        <User className="h-6 w-6" />
                                    </div>
                                    <h3 className="font-bold text-lg">No Additional Users</h3>
                                    <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-2">
                                        Only the system account currently has access. Create a new user to grant application access.
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl flex items-start gap-3">
                        <div className="mt-0.5 p-1 bg-primary/10 rounded-full">
                            <ShieldCheck className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-primary tracking-tight">Security Best Practice</p>
                            <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                                It is highly recommended to use unique users for each application connecting to this database.
                                Never use the shared system 'root' or 'postgres' account in production apps.
                            </p>
                        </div>
                    </div>
                </div>

                <div>
                    <UserCreateForm
                        serverId={serverId}
                        engine={engine}
                        dbName={dbName}
                        onSuccess={handleSuccess}
                    />
                </div>
            </div>
        </div>
    );
}
