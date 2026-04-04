'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, ArrowUpCircle, CheckCircle2, AlertCircle, HardDrive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageTitleWithComponent } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { getSystemUpdates, refreshPackageList, getInstalledPackages, type PackageUpdate } from './actions';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

const COLORS = [
    'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500', 'bg-lime-500',
    'bg-green-500', 'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-sky-500',
    'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500',
    'bg-pink-500', 'bg-rose-500'
];

function PackageIcon({ name }: { name: string }) {
    const initial = name.charAt(0).toUpperCase();
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colorClass = COLORS[hash % COLORS.length];

    return (
        <div className={cn("h-9 w-9 rounded-md flex items-center justify-center text-white shrink-0 font-bold shadow-sm", colorClass)}>
            {initial}
        </div>
    );
}

export function UpdatesClient({ serverId, serverName, showTitle = true }: { serverId: string, serverName: string, showTitle?: boolean }) {
    const { toast } = useToast();
    const router = useRouter();
    const [systemUpdates, setSystemUpdates] = useState<PackageUpdate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchUpdates = async (forceRefresh = false) => {
        setIsLoading(true);
        setError(null);

        if (forceRefresh) {
            setIsRefreshing(true);
            const refreshRes = await refreshPackageList(serverId);
            setIsRefreshing(false);
            if (refreshRes.error) {
                setError(refreshRes.error);
                setIsLoading(false);
                return;
            }
        }

        const { updates: newUpdates, error: fetchError } = await getSystemUpdates(serverId);

        if (fetchError) {
            setError(fetchError);
            setSystemUpdates([]);
        } else {
            setSystemUpdates(newUpdates || []);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        // Force refresh on mount so reloading the page checks for updates
        fetchUpdates(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serverId]);

    const handleRefresh = () => {
        fetchUpdates(true);
    };

    const handleItemClick = (type: 'sys', name: string) => {
        router.push(`/server/system/updates/${type}.${name}`);
    };

    const SystemUpdatesSection = () => (
        isLoading && !isRefreshing ? (
            <div className="space-y-4">
                <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className={cn(
                            "p-4 min-w-0 w-full",
                            i !== 4 && "border-b border-border"
                        )}>
                            <div className="space-y-3">
                                <Skeleton className="h-4 w-1/3" />
                                <div className="flex gap-6">
                                    <Skeleton className="h-3 w-16" />
                                    <Skeleton className="h-3 w-16" />
                                </div>
                            </div>
                        </div>
                    ))}
                </Card>
            </div>
        ) : systemUpdates.length === 0 && !error ? (
            <Card className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground border-dashed">
                <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mb-4 text-green-600 dark:text-green-500">
                    <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-medium text-foreground">System is Up to Date</h3>
                <p className="max-w-sm mt-2 mb-6">No package updates are currently available.</p>
                <Button variant="secondary" onClick={() => window.location.reload()}>
                    Reload Page
                </Button>
            </Card>
        ) : (
            <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">System Packages ({systemUpdates.length})</h3>
                </div>
                <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm">
                    {systemUpdates.map((pkg, index) => (
                        <div
                            key={`sys-${pkg.name}-${index}`}
                            className={cn(
                                "p-4 min-w-0 w-full transition-colors hover:bg-muted/50 cursor-pointer",
                                index !== systemUpdates.length - 1 && "border-b border-border"
                            )}
                            onClick={() => handleItemClick('sys', pkg.name)}
                        >
                            <div className="flex items-start gap-4">
                                <PackageIcon name={pkg.name} />
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between mb-3">
                                        <p className="text-sm font-medium text-foreground break-all font-mono leading-tight">
                                            {pkg.name}
                                        </p>
                                        <Badge variant="outline" className="text-xs font-normal text-muted-foreground ml-2">
                                            {pkg.architecture}
                                        </Badge>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <span className="text-muted-foreground/70">Current:</span>
                                            <span className="font-mono text-red-500/80 line-through">{pkg.currentVersion}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <span className="text-muted-foreground/70">Update:</span>
                                            <span className="font-mono text-green-600 dark:text-green-500 font-medium">{pkg.newVersion}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </Card>
            </div>
        )
    );

    return (
        <div className="space-y-8">
            {showTitle && (
                <PageTitleWithComponent
                    title="System Updates"
                    description="Manage system package updates"
                    serverName={serverName}
                    actionComponent={<div />}
                />
            )}

            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <div className="space-y-4">
                <SystemUpdatesSection />
            </div>
        </div>
    );
}
