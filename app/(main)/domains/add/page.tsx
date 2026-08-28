"use client";

import React, { useState, useEffect, useTransition, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/component/ui/card';
import { Button } from '@/component/ui/button';
import { Input } from '@/component/ui/input';
import { Skeleton } from '@/component/ui/skeleton';
import { useToast } from '@/core/hooks/useToast';
import { Search, CheckCircle, XCircle, ShoppingCart, Loader2, ArrowLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { checkDomain } from '@/services/domains/domains-service';
import type { DomainStatus } from '@/services/domains/types';
import Link from 'next/link';
import { PageTitleBack } from '@/components/page-header';
import { cn } from '@/core/utils';
import { Badge } from '@/component/ui/badge';

function DomainListResult({ results, isLoading, query }: { results: DomainStatus[], isLoading: boolean, query: string }) {
    const { toast } = useToast();

    const handlePurchase = (e: React.MouseEvent, domain: DomainStatus) => {
        e.stopPropagation();
        toast({
            title: "Feature not available",
            description: `Purchasing for ${domain.name} is not implemented in this demo.`,
        });
    };

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

    if (results.length === 0 && query && !isLoading) {
        return (
            <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm">
                <div className="text-center p-12 text-muted-foreground">
                    <p>No results found for &quot;{query}&quot;</p>
                </div>
            </Card>
        )
    }

    if (results.length === 0) return null;

    return (
        <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm">
            {results.map((domain, index) => (
                <div
                    key={domain.name}
                    className={cn(
                        "p-4 min-w-0 w-full transition-colors hover:bg-muted/50 group flex items-start gap-4 cursor-pointer",
                        index !== results.length - 1 && "border-b border-border"
                    )}
                >
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between mb-0">
                            <div>
                                <h3 className="font-semibold leading-none tracking-tight truncate pr-4 text-foreground group-hover:underline decoration-muted-foreground/30 underline-offset-4 text-lg">
                                    {domain.name}
                                </h3>
                                <div className="flex items-center gap-3 mt-2">
                                    {domain.isAvailable ? (
                                        <>
                                            <Badge variant="default" className="bg-green-500/10 text-green-700 border-green-200 hover:bg-green-500/20 px-2 py-0.5 text-xs font-medium border shadow-none rounded-md">Available</Badge>
                                            <span className="text-sm text-foreground font-medium flex items-center">
                                                ${domain.price.toFixed(2)}
                                                <span className="text-xs text-muted-foreground ml-1 font-normal">/ year</span>
                                            </span>
                                        </>
                                    ) : (
                                        <Badge variant="destructive" className="px-2 py-0.5 text-xs font-medium shadow-none rounded-md">Taken</Badge>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {domain.isAvailable ? (
                                    <Button size="sm" onClick={(e) => handlePurchase(e, domain)} className="ml-2 h-8">
                                        <ShoppingCart className="mr-2 h-3 w-3" />
                                        Add to Cart
                                    </Button>
                                ) : (
                                    <Button size="sm" variant="outline" className="ml-2 h-8" asChild>
                                        <a href={`https://www.whois.com/whois/${domain.name}`} target="_blank" rel="noopener noreferrer">
                                            WHOIS
                                            <ExternalLink className="ml-2 h-3 w-3" />
                                        </a>
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </Card>
    );
}

function LoadingSkeleton() {
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

function FindDomainContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const query = searchParams.get('query') || searchParams.get('q') || '';

    const [searchTerm, setSearchTerm] = useState(query);
    const [results, setResults] = useState<DomainStatus[]>([]);
    const [isSearching, startTransition] = useTransition();

    useEffect(() => {
        setSearchTerm(query);
        if (query) {
            performSearch(query);
        }
    }, [query]);

    const performSearch = (term: string) => {
        startTransition(async () => {
            const data = await checkDomain(term);
            setResults(data);
        });
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchTerm.trim()) {
            router.push(`/domains/add?query=${encodeURIComponent(searchTerm)}`);
        }
    };

    return (
        <div className="space-y-6">
            <PageTitleBack
                title="Find a domain for you"
                description="Find your perfect domain name."
                backHref="/domains"
            />

            <div className="max-w-full">
                <form onSubmit={handleSearch} className="relative flex items-center">
                    <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
                    <Input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="example.com"
                        className="pl-9 pr-24 h-10 w-full"
                    />
                    <div className="absolute right-1">
                        <Button type="submit" disabled={isSearching} size="sm" className="h-8 px-3">
                            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
                        </Button>
                    </div>
                </form>
            </div>

            <div className="space-y-4">
                <DomainListResult results={results} isLoading={isSearching} query={query} />

                {!query && (
                    <div className="text-center text-muted-foreground py-8">
                        <p>Enter a domain name above to search.</p>
                    </div>
                )}
            </div>
        </div >
    );
}

export default function FindDomainPage() {
    return (
        <Suspense fallback={<LoadingSkeleton />}>
            <FindDomainContent />
        </Suspense>
    )
}
