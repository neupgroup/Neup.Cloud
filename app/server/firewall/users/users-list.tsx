'use client';

import {
    Card,
} from "@/components/ui/card";
import { User, Shield, Terminal, Plus, ChevronRight, UserCog } from "lucide-react";
import { SystemUser } from './actions';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export default function UsersList({ users, isLoading }: { users: SystemUser[], isLoading: boolean }) {
    if (isLoading) {
        return (
            <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className={cn(
                        "p-4 min-w-0 w-full",
                        i !== 3 && "border-b border-border"
                    )}>
                        <div className="space-y-3">
                            <Skeleton className="h-4 w-full" />
                            <div className="flex gap-6">
                                <Skeleton className="h-3 w-16" />
                                <Skeleton className="h-3 w-16" />
                            </div>
                        </div>
                    </div>
                ))}
            </Card>
        );
    }

    return (
        <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm">
            {/* Add User Item */}
            <div className="border-b border-border">
                <Link href="/server/firewall/users/create" className="flex items-center justify-between p-4 w-full hover:bg-muted/50 transition-colors group">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-primary/10 rounded-full text-primary">
                            <Plus className="h-4 w-4" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-foreground">Create New User</p>
                            <p className="text-xs text-muted-foreground">Add a new system account to this instance</p>
                        </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </Link>
            </div>

            {users.map((user, index) => (
                <div key={user.username} className={cn(
                    "min-w-0 w-full transition-colors hover:bg-muted/50",
                    index !== users.length - 1 && "border-b border-border"
                )}>
                    <Link href={`/server/firewall/users/${user.username}`} className="flex items-center justify-between p-4 w-full group">
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <p className="text-sm font-medium text-foreground break-all font-mono leading-tight">
                                    {user.username}
                                </p>
                                <Badge variant={user.type === 'root' ? 'destructive' : 'secondary'} className="text-[10px] px-1.5 py-0 h-5">
                                    {user.type}
                                </Badge>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <div className="font-mono text-xs">UID: {user.uid}</div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <Terminal className="h-3.5 w-3.5" />
                                    <span className="font-mono">{user.shell}</span>
                                </div>
                                {user.description && user.description !== user.username && (
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <UserCog className="h-3.5 w-3.5" />
                                        <span>{user.description}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors ml-4 shrink-0" />
                    </Link>
                </div>
            ))}

            {users.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                    No users found.
                </div>
            )}
        </Card>
    )
}
