'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Package, Search, PackageCheck, PackagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageTitleWithComponent } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getInstalledPackages, type PackageUpdate } from '../updates/actions';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

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

export function PackagesClient({ serverId, serverName, showTitle = true }: { serverId: string, serverName: string, showTitle?: boolean }) {
    const { toast } = useToast();
    const router = useRouter();

    // Installed Packages State
    const [installedPackages, setInstalledPackages] = useState<PackageUpdate[]>([]);
    const [isInstalledLoading, setIsInstalledLoading] = useState(true);
    const [installedError, setInstalledError] = useState<string | null>(null);
    const [installedSearch, setInstalledSearch] = useState('');
    const [displayLimit, setDisplayLimit] = useState(50);

    // Initial Fetch for Installed
    useEffect(() => {
        fetchInstalled();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serverId]);

    // Reset pagination when search changes
    useEffect(() => {
        setDisplayLimit(50);
    }, [installedSearch]);

    async function fetchInstalled() {
        setIsInstalledLoading(true);
        setInstalledError(null);
        const res = await getInstalledPackages(serverId);
        if (res.error) {
            setInstalledError(res.error);
            setInstalledPackages([]);
        } else {
            setInstalledPackages(res.packages || []);
        }
        setIsInstalledLoading(false);
    }

    const allFiltered = installedPackages
        .filter(p => p.name.toLowerCase().includes(installedSearch.toLowerCase()));

    const displayedPackages = allFiltered.slice(0, displayLimit);
    const hasMore = allFiltered.length > displayLimit;

    const handleLoadMore = () => {
        setDisplayLimit(prev => prev + 50);
    };

    const handleItemClick = (name: string) => {
        router.push(`/server/system/packages/${name}`);
    };

    return (
        <div className="space-y-6">
            {showTitle && (
                <PageTitleWithComponent
                    title="Packages"
                    description={`Software library (${installedPackages.length} installed)`}
                    serverName={serverName}
                    actionComponent={<div />}
                />
            )}

            <div className="space-y-4">
                <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search installed packages..."
                        value={installedSearch}
                        onChange={(e) => setInstalledSearch(e.target.value)}
                        className="pl-9 bg-background"
                    />
                </div>

                {installedError && (
                    <Alert variant="destructive">
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{installedError}</AlertDescription>
                    </Alert>
                )}

                {isInstalledLoading ? (
                    <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="p-4 border-b">
                                <div className="flex gap-4">
                                    <Skeleton className="h-9 w-9 rounded-md" />
                                    <div className="flex-1 space-y-2">
                                        <Skeleton className="h-4 w-1/3" />
                                        <Skeleton className="h-3 w-1/4" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </Card>
                ) : (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                            <p className="text-sm text-muted-foreground">
                                Showing {displayedPackages.length} of {allFiltered.length} packages
                            </p>
                        </div>
                        <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm">
                            {/* Install New Package Card */}
                            <div
                                className="p-4 min-w-0 w-full transition-colors hover:bg-muted/50 cursor-pointer border-b border-border"
                                onClick={() => router.push('/server/system/packages/install')}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="h-9 w-9 rounded-md flex items-center justify-center bg-primary/10 text-primary shrink-0 font-bold shadow-sm">
                                        <PackagePlus className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-start justify-between mb-1">
                                            <p className="text-sm font-medium text-foreground">
                                                Install New Package
                                            </p>
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            Search and install new software from the repository
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {displayedPackages.length === 0 ? (
                                <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
                                    <PackageCheck className="h-10 w-10 mb-3 opacity-20" />
                                    <p>No installed packages found matching search.</p>
                                </div>
                            ) : (
                                <>
                                    {displayedPackages.map((pkg, index) => (
                                        <div
                                            key={`inst-${pkg.name}-${index}`}
                                            className={cn(
                                                "p-4 min-w-0 w-full transition-colors hover:bg-muted/50 cursor-pointer",
                                                index !== displayedPackages.length - 1 && "border-b border-border" // Only border if not last displayed item
                                            )}
                                            onClick={() => handleItemClick(pkg.name)}
                                        >
                                            <div className="flex items-start gap-4">
                                                <PackageIcon name={pkg.name} />
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-start justify-between mb-1">
                                                        <p className="text-sm font-medium text-foreground break-all font-mono leading-tight">
                                                            {pkg.name}
                                                        </p>
                                                        <Badge variant="secondary" className="text-xs font-normal">
                                                            Installed
                                                        </Badge>
                                                    </div>
                                                    <div className="text-xs text-muted-foreground font-mono">
                                                        {pkg.currentVersion} • {pkg.architecture}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {hasMore && (
                                        <div className="p-4 border-t flex justify-center">
                                            <Button variant="ghost" onClick={handleLoadMore} className="w-full text-muted-foreground">
                                                Load More ({allFiltered.length - displayedPackages.length} remaining)
                                            </Button>
                                        </div>
                                    )}
                                </>
                            )}
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
}
