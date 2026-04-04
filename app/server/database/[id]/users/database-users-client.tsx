'use client';

import { Card } from "@/components/ui/card";
import { User, Plus, Shield, ShieldCheck, ChevronRight } from "lucide-react";
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Badge } from "@/components/ui/badge";
import type { DatabaseUser } from "@/actions/database";

export default function DatabaseUsersClient({ users, dbId }: { users: DatabaseUser[], dbId: string }) {

    // Construct the create URL
    const createUrl = `/server/database/${dbId}/users/create`;

    return (
        <div className="space-y-6">
            <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm">
                {/* Create New User Item (First "Card") */}
                <Link href={createUrl} className="block group">
                    <div className="p-4 min-w-0 w-full transition-colors group-hover:bg-muted/50 border-b border-dashed border-border bg-muted/5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 min-w-0 flex-1">
                                <div className="p-2 rounded-lg shrink-0 bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                                    <Plus className="h-5 w-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-medium text-base text-primary group-hover:text-primary/80 transition-colors">Create New Database User</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Add a new user with specific permissions to this database.
                                    </p>
                                </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
                        </div>
                    </div>
                </Link>

                {/* Existing Users List */}
                {users.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                        <p>No other users found for this database.</p>
                    </div>
                ) : (
                    users.map((user, index) => (
                        <Link
                            key={`${user.username}-${user.host}`}
                            href={`/server/database/${dbId}/users/${user.username}`}
                            className="block group"
                        >
                            <div className={cn(
                                "p-4 min-w-0 w-full transition-colors group-hover:bg-muted/50",
                                index !== users.length - 1 && "border-b border-border"
                            )}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4 min-w-0 flex-1">
                                        <div className="p-2 rounded-lg shrink-0 bg-secondary text-secondary-foreground">
                                            <User className="h-5 w-5" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-mono text-sm font-semibold">{user.username}</span>
                                                <Badge variant={user.permissions === 'full' ? 'default' : 'secondary'} className="text-[10px] h-5 capitalize">
                                                    {user.permissions} Access
                                                </Badge>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <Shield className="h-3.5 w-3.5" />
                                                    <span>Host: <span className="font-mono text-foreground">{user.host || '%'}</span></span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
                                </div>
                            </div>
                        </Link>
                    ))
                )}
            </Card>
        </div>
    );
}
