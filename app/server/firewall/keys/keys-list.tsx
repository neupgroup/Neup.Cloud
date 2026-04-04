'use client';

import { useState, useEffect } from 'react';
import {
    Card,
} from "@/components/ui/card";
import { Key, FolderOpen, Hash } from "lucide-react";
import { getAuthorizedKeys, type SshKey } from './actions';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

import { Plus, ChevronRight } from "lucide-react";
import Link from "next/link";

function KeysListItems({ keys, isLoading }: { keys: SshKey[], isLoading: boolean }) {
    if (isLoading) {
        return (
            <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className={cn(
                        "p-4 min-w-0 w-full",
                        i !== 3 && "border-b border-border" // 3 = last index
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
            {/* Add Key Item */}
            <div className="border-b border-border">
                <Link href="/server/firewall/keys/create" className="flex items-center justify-between p-4 w-full hover:bg-muted/50 transition-colors group">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-primary/10 rounded-full text-primary">
                            <Plus className="h-4 w-4" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-foreground">Add Authorized Key</p>
                            <p className="text-xs text-muted-foreground">Authorize a new SSH key for access</p>
                        </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </Link>
            </div>

            {keys.map((keyItem, index) => (
                <div key={keyItem.index} className={cn(
                    "min-w-0 w-full transition-colors hover:bg-muted/50",
                    index !== keys.length - 1 && "border-b border-border"
                )}>
                    <Link href={`/server/firewall/keys/${keyItem.index}`} className="flex items-center justify-between p-4 w-full group">
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <p className="text-sm font-medium text-foreground break-all font-mono leading-tight">
                                    {keyItem.comment !== 'No comment' ? keyItem.comment : `Key #${keyItem.index + 1}`}
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <Key className="h-3.5 w-3.5" />
                                    <span className="font-mono">{keyItem.type}</span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <Hash className="h-3.5 w-3.5" />
                                    <span className="font-mono truncate max-w-[200px]" title={keyItem.preview}>
                                        {keyItem.preview}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <FolderOpen className="h-3.5 w-3.5" />
                                    <span className="font-mono">{keyItem.source.split('/').pop()}</span>
                                </div>
                            </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors ml-4 shrink-0" />
                    </Link>
                </div>
            ))}
        </Card>
    )
}

export default function KeysList({ serverId, isLoadingOverride }: { serverId?: string, isLoadingOverride?: boolean }) {
    const { toast } = useToast();
    const [keys, setKeys] = useState<SshKey[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchKeys() {
            if (!serverId) {
                // If strictly no serverId and no override, stop loading.
                // But if override is true (from loading.tsx context? no loading.tsx unmounts when page mounts), 
                // actually loading.tsx replaces page.
                // This component is used inside page.tsx.
                // AND used inside loading.tsx.
                // If inside loading.tsx, serverId is undefined.
                // We want to show skeleton.
                if (!isLoadingOverride) setIsLoading(false);
                return;
            }

            setIsLoading(true);
            setError(null);
            try {
                const result = await getAuthorizedKeys(serverId);
                if (result.error) {
                    setError(result.error);
                    toast({ variant: 'destructive', title: 'Failed to get keys', description: result.error });
                } else if (result.keys) {
                    setKeys(result.keys);
                }
            } catch (e: any) {
                setError(e.message);
                toast({ variant: 'destructive', title: 'An unexpected error occurred', description: e.message });
            } finally {
                setIsLoading(false);
            }
        }
        fetchKeys();
    }, [serverId, toast, isLoadingOverride]);

    if (isLoadingOverride) {
        return <KeysListItems keys={[]} isLoading={true} />;
    }

    if (!serverId) {
        return (
            <Card className="p-8 text-center text-muted-foreground">
                <p>Please select a server to view keys.</p>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className="p-8 text-center text-destructive">
                <p>Error loading keys: {error}</p>
                <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>Retry</Button>
            </Card>
        );
    }

    return <KeysListItems keys={keys} isLoading={isLoading} />;
}
