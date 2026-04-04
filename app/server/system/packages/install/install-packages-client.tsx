'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Package, Search, PackagePlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageTitleWithComponent } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { searchAvailablePackages } from '../actions';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from 'use-debounce';

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

export function InstallPackagesClient({ serverId, serverName }: { serverId: string, serverName: string }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialQuery = searchParams.get('query') || '';

    const [searchQuery, setSearchQuery] = useState(initialQuery);
    const [debouncedSearch] = useDebounce(searchQuery, 300);
    const [searchResults, setSearchResults] = useState<{ name: string, description: string }[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);

    useEffect(() => {
        if (debouncedSearch.length > 2) {
            handleSearch(debouncedSearch);
            router.replace(`/server/system/packages/install?query=${encodeURIComponent(debouncedSearch)}`, { scroll: false });
        } else {
            setSearchResults([]);
            if (debouncedSearch.length === 0) {
                router.replace('/server/system/packages/install', { scroll: false });
            }
        }
    }, [debouncedSearch, router]);

    async function handleSearch(term: string) {
        setIsSearching(true);
        setSearchError(null);
        const res = await searchAvailablePackages(serverId, term);
        if (res.error) {
            setSearchError(res.error);
            setSearchResults([]);
        } else {
            setSearchResults(res.packages || []);
        }
        setIsSearching(false);
    }

    const handleItemClick = (name: string) => {
        router.push(`/server/system/packages/install/${name}`);
    };

    return (
        <div className="space-y-6">
            <PageTitleWithComponent
                title="Install New Package"
                description={`Search and install software on ${serverName}`}
                actionComponent={<div />}
            />

            <div className="space-y-4">
                <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search for packages to install..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 bg-background"
                        autoFocus
                    />
                </div>

                {searchError && (
                    <Alert variant="destructive">
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{searchError}</AlertDescription>
                    </Alert>
                )}

                {isSearching ? (
                    <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="p-4 border-b">
                                <div className="flex gap-4">
                                    <Skeleton className="h-9 w-9 rounded-md" />
                                    <div className="flex-1 space-y-2">
                                        <Skeleton className="h-4 w-1/3" />
                                        <Skeleton className="h-3 w-1/2" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </Card>
                ) : (
                    <div className="space-y-2">
                        {searchResults.length > 0 && (
                            <div className="flex items-center justify-between px-1">
                                <p className="text-sm text-muted-foreground">
                                    Found {searchResults.length} packages
                                </p>
                            </div>
                        )}
                        <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm">
                            {searchResults.length === 0 ? (
                                <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
                                    <PackagePlus className="h-10 w-10 mb-3 opacity-20" />
                                    {searchQuery.length > 0 ? (
                                        <p>No available packages found matching "{searchQuery}".</p>
                                    ) : (
                                        <p>Type in the search box to find packages.</p>
                                    )}
                                </div>
                            ) : (
                                searchResults.map((pkg, index) => (
                                    <div
                                        key={`avail-${pkg.name}-${index}`}
                                        className={cn(
                                            "p-4 min-w-0 w-full transition-colors hover:bg-muted/50 cursor-pointer",
                                            index !== searchResults.length - 1 && "border-b border-border"
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
                                                    <Badge variant="outline" className="text-xs font-normal">
                                                        Available
                                                    </Badge>
                                                </div>
                                                <div className="text-xs text-muted-foreground font-mono line-clamp-2">
                                                    {pkg.description}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
}
