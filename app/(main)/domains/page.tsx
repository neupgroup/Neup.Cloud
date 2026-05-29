"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    Card,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Globe,
    Search,
    Plus,
    ArrowRight,
    ChevronRight,
    Network
} from 'lucide-react';
import { getDomains } from '@/services/domains/domains-service';
import type { ManagedDomain } from '@/services/domains/types';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/core/utils';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

function ManagedDomainList({ domains, isLoading, searchQuery }: { domains: ManagedDomain[], isLoading: boolean, searchQuery: string }) {
    const router = useRouter();

    const getStatusBadge = (status: ManagedDomain['status']) => {
        switch (status) {
            case 'active':
                return <Badge variant="default" className="bg-green-500/10 text-green-700 border-green-200 hover:bg-green-500/20 px-2 py-0.5 text-xs font-medium border shadow-none rounded-md">Active</Badge>;
            case 'error':
                return <Badge variant="destructive" className="px-2 py-0.5 text-xs font-medium shadow-none rounded-md">Error</Badge>;
            case 'pending':
            default:
                return <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-700 border-yellow-200 hover:bg-yellow-500/20 px-2 py-0.5 text-xs font-medium border shadow-none rounded-md">Pending</Badge>;
        }
    };

    const filteredDomains = domains.filter(domain =>
        domain.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (isLoading) {
        return (
            <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className={cn(
                        "p-4 min-w-0 w-full",
                        i !== 4 && "border-b border-border"
                    )}>
                        <div className="space-y-3">
                            <Skeleton className="h-6 w-1/3" />
                            <Skeleton className="h-4 w-1/2" />
                        </div>
                    </div>
                ))}
            </Card>
        )
    }

    if (domains.length === 0 && !searchQuery) {
        return null; // Don't show anything if no domains and no search (empty state handled in parent via static cards)
    }

    if (filteredDomains.length > 0) {
        return (
            <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm">
                {filteredDomains.map((domain, index) => (
                    <div
                        key={domain.id}
                        className={cn(
                            "p-4 min-w-0 w-full transition-colors hover:bg-muted/50 group flex items-start gap-4 cursor-pointer",
                            index !== filteredDomains.length - 1 && "border-b border-border"
                        )}
                        onClick={() => router.push(`/domains/${domain.id}`)}
                    >
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between mb-0">
                                <h3 className="font-semibold leading-none tracking-tight truncate pr-4 text-foreground group-hover:underline decoration-muted-foreground/30 underline-offset-4">
                                    {domain.name}
                                </h3>

                                <div className="flex items-center gap-2">
                                    {getStatusBadge(domain.status)}
                                    <div className="h-8 w-8 flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors">
                                        <ChevronRight className="h-4 w-4" />
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                <span>Added {formatDistanceToNow(new Date(domain.addedAt), { addSuffix: true })}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </Card>
        );
    }

    if (searchQuery) {
        return (
            <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm">
                <div className="text-center p-12 text-muted-foreground">
                    <p>No domains found matching &quot;{searchQuery}&quot;</p>
                </div>
            </Card>
        )
    }

    return null;
}

export default function DomainsPage() {
    const router = useRouter();
    const [managedDomains, setManagedDomains] = useState<ManagedDomain[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const fetchDomains = async () => {
            setIsLoading(true);
            try {
                const data = await getDomains();
                setManagedDomains(data);
            } finally {
                setIsLoading(false);
            }
        };
        fetchDomains();
    }, []);

    return (
        <div className="grid gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold font-headline tracking-tight">Domains</h1>
                    <p className="text-muted-foreground">
                        Manage your existing domains or find a new one.
                    </p>
                </div>
            </div>

            <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search domains..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                />
            </div>

            {/* Static Actions: Only if no search query */}
            {!searchQuery && (
                <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm">
                    {/* Get a new domain */}
                    <div
                        className={cn(
                            "p-4 min-w-0 w-full transition-colors hover:bg-muted/50 group flex items-start gap-4 cursor-pointer border-b border-border",
                        )}
                        onClick={() => router.push('/domains/add')}
                    >
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between mb-0 h-8">
                                <h3 className="font-semibold leading-none tracking-tight truncate pr-4 text-foreground group-hover:underline decoration-muted-foreground/30 underline-offset-4">
                                    Get a New Domain
                                </h3>
                                <div className="flex items-center gap-1">
                                    <div className="h-8 w-8 flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors">
                                        <ChevronRight className="h-4 w-4" />
                                    </div>
                                </div>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                                Search and register a new domain name
                            </p>
                        </div>
                    </div>

                    {/* Connect existing domain */}
                    <div
                        className={cn(
                            "p-4 min-w-0 w-full transition-colors hover:bg-muted/50 group flex items-start gap-4 cursor-pointer border-b border-border",
                        )}
                        onClick={() => router.push('/domains/connect')}
                    >
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between mb-0 h-8">
                                <h3 className="font-semibold leading-none tracking-tight truncate pr-4 text-foreground group-hover:underline decoration-muted-foreground/30 underline-offset-4">
                                    Connect Existing Domain
                                </h3>
                                <div className="flex items-center gap-1">
                                    <div className="h-8 w-8 flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors">
                                        <ChevronRight className="h-4 w-4" />
                                    </div>
                                </div>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                                Use a domain you already own with Neup Cloud
                            </p>
                        </div>
                    </div>

                    {/* Bulk domain checker */}
                    <div
                        className={cn(
                            "p-4 min-w-0 w-full transition-colors hover:bg-muted/50 group flex items-start gap-4 cursor-pointer",
                        )}
                        onClick={() => router.push('/domains/bulk')}
                    >
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between mb-0 h-8">
                                <h3 className="font-semibold leading-none tracking-tight truncate pr-4 text-foreground group-hover:underline decoration-muted-foreground/30 underline-offset-4">
                                    Bulk Availability Check
                                </h3>
                                <div className="flex items-center gap-1">
                                    <div className="h-8 w-8 flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors">
                                        <ChevronRight className="h-4 w-4" />
                                    </div>
                                </div>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                                Paste CSV domains and quickly estimate if they are available
                            </p>
                        </div>
                    </div>
                </Card>
            )}

            <ManagedDomainList domains={managedDomains} isLoading={isLoading} searchQuery={searchQuery} />
        </div>
    );
}
