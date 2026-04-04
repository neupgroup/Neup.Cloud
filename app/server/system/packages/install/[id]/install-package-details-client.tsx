'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, RefreshCcw, Download, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageTitleBackWithComponent } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { getPackageVersions, installPackage, type PackageVersionInfo } from '../../actions';
import { cn } from '@/lib/utils'; // Correct import path assuming this file is deep

export function InstallPackageDetailsClient({ serverId, serverName, packageName }: { serverId: string, serverName: string, packageName: string }) {
    const { toast } = useToast();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [versions, setVersions] = useState<PackageVersionInfo[]>([]);
    const [currentVersion, setCurrentVersion] = useState<string | null>(null);
    const [candidateVersion, setCandidateVersion] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isActionLoading, setIsActionLoading] = useState(false);

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serverId, packageName]);

    async function fetchData() {
        setIsLoading(true);
        setError(null);
        // Reuse the same action as the main details page
        const res = await getPackageVersions(serverId, packageName);
        if (res.error) {
            setError(res.error);
        } else {
            setVersions(res.versions || []);
            setCurrentVersion(res.currentInstalled || null);
            setCandidateVersion(res.candidate || null);
        }
        setIsLoading(false);
    }

    const handleInstall = async (version?: string) => {
        setIsActionLoading(true);
        const res = await installPackage(serverId, packageName, version);
        setIsActionLoading(false);
        if (res.error) {
            toast({ variant: 'destructive', title: 'Install Failed', description: res.error });
        } else {
            toast({ title: 'Success', description: `Package ${packageName} installed successfully.` });
            // Redirect to installed packages page after successful install? Or stay here?
            // User might want to verify install.
            fetchData();
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-8">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-md" />
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-4 w-64" />
                    </div>
                </div>

                {/* Status Section Skeleton */}
                <div className="space-y-2">
                    <Skeleton className="h-4 w-16 px-1" />
                    <Card>
                        <CardContent className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-32" />
                                    <Skeleton className="h-8 w-40" />
                                </div>
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-32" />
                                    <Skeleton className="h-8 w-40" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Available Versions Skeleton */}
                <div className="space-y-4">
                    <Skeleton className="h-4 w-32 px-1" />
                    <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                            <Card key={i}>
                                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-3">
                                            <Skeleton className="h-6 w-24" />
                                            <Skeleton className="h-6 w-16" />
                                        </div>
                                        <Skeleton className="h-3 w-40" />
                                    </div>
                                    <Skeleton className="h-9 w-24" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="space-y-6">
                <PageTitleBackWithComponent
                    title="Package Error"
                    backHref="/server/system/packages/install"
                    actionComponent={<div />}
                />
                <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            </div>
        )
    }

    const isInstalled = !!currentVersion;

    return (
        <div className="space-y-8">
            <PageTitleBackWithComponent
                title={packageName}
                description="Install new package"
                backHref="/server/system/packages/install"
                actionComponent={<div />}
            />

            {/* Section 1: Status */}
            <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">Status</h3>
                <Card>
                    <CardContent className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground mb-1">Installed Version</p>
                                <div className="flex items-center gap-2">
                                    <span className="text-lg font-mono font-medium text-foreground">
                                        {currentVersion || 'Not Installed'}
                                    </span>
                                    {isInstalled && <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100">Active</Badge>}
                                </div>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground mb-1">Candidate Version</p>
                                <div className="flex items-center gap-2">
                                    <span className="text-lg font-mono font-medium text-foreground">
                                        {candidateVersion || 'Unknown'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Section 2: Available Versions */}
            <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">Available Versions</h3>
                <div className="space-y-3">
                    {versions.length === 0 ? (
                        <Card className="p-6 text-center text-muted-foreground">
                            No version information found.
                        </Card>
                    ) : (
                        versions.map((ver, i) => (
                            <Card key={i} className={cn("transition-colors hover:bg-muted/30", ver.version === currentVersion && "border-green-200 bg-green-50/30 dark:bg-green-900/10")}>
                                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <span className="font-mono font-semibold text-base">{ver.version}</span>
                                            {ver.version === currentVersion && (
                                                <Badge className="bg-green-600 hover:bg-green-700">Current</Badge>
                                            )}
                                            {ver.version === candidateVersion && ver.version !== currentVersion && (
                                                <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50">Candidate</Badge>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">Source: {ver.source}</p>
                                    </div>
                                    <div>
                                        {ver.version === currentVersion ? (
                                            <Button variant="ghost" disabled size="sm" className="w-full sm:w-auto">Installed</Button>
                                        ) : (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={isActionLoading}
                                                onClick={() => handleInstall(ver.version)}
                                                className="w-full sm:w-auto"
                                            >
                                                <Download className="h-4 w-4 mr-2" />
                                                {isInstalled ? 'Switch to this' : 'Install'}
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </div>

            {/* Actions Below */}
            <div className="flex flex-col sm:flex-row gap-3">
                {isInstalled ? (
                    <Button
                        variant="ghost"
                        className="w-full sm:w-auto text-muted-foreground"
                        onClick={() => router.push(`/server/system/packages/${packageName}`)}
                    >
                        Go to Package Management <ArrowLeft className="ml-2 h-4 w-4 rotate-180" />
                    </Button>
                ) : (
                    <Button
                        size="lg"
                        onClick={() => handleInstall()}
                        disabled={isActionLoading}
                        className="w-full sm:w-auto"
                    >
                        {isActionLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                        Install Default Version
                    </Button>
                )}
            </div>
        </div>
    );
}
