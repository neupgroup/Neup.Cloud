'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageTitleBack } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Package, ArrowUpCircle, CheckCircle2, Loader2, Play } from 'lucide-react';
import { getPackageDetails, updatePackage } from '../actions';

interface PackageDetails {
    raw: string;
    description: string;
    homepage: string | null;
}

export function UpdateDetailsClient({ serverId, serverName, id }: { serverId: string, serverName: string, id: string }) {
    const { toast } = useToast();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [details, setDetails] = useState<PackageDetails | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);

    // Parse ID
    // apt.<name> or sys.<name>
    const [type, ...nameParts] = id.split('.');
    const packageName = nameParts.join('.'); // Join back in case name has dots

    const isSystemUpdate = type === 'sys';

    useEffect(() => {
        async function fetchDetails() {
            setIsLoading(true);
            const res = await getPackageDetails(serverId, packageName);
            if (res.error) {
                setError(res.error);
            } else if (res.details) {
                setDetails(res.details);
            }
            setIsLoading(false);
        }
        fetchDetails();
    }, [serverId, packageName]);

    const handleUpdate = async () => {
        setIsUpdating(true);
        const res = await updatePackage(serverId, packageName);

        if (res.error) {
            toast({
                variant: 'destructive',
                title: 'Update Failed',
                description: res.error
            });
        } else {
            toast({
                title: 'Update Successful',
                description: `Package ${packageName} has been updated.`
            });
            // Redirect back to list after short delay? Or stay?
            // Usually stay to see output or updated state.
            // But since we just ran install, staying might show same details unless we refresh.
            // Let's redirect back.
            router.push('/server/system/updates');
        }
        setIsUpdating(false);
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                </div>
                <Card>
                    <CardHeader><Skeleton className="h-6 w-1/4" /></CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (error) {
        return (
            <div className="space-y-6">
                <PageTitleBack
                    title="Package Details"
                    serverName={serverName}
                    backHref="/server/system/updates"
                />
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <PageTitleBack
                title={packageName}
                description={isSystemUpdate ? "System Update Available" : "Installed Package"}
                serverName={serverName}
                backHref="/server/system/updates"
            />

            <Card>
                <CardHeader>
                    <div className="flex items-start justify-between">
                        <div>
                            <CardTitle className="text-xl flex items-center gap-2">
                                <Package className="h-5 w-5 text-primary" />
                                {packageName}
                            </CardTitle>
                            <CardDescription className="mt-2">
                                {isSystemUpdate ? (
                                    <Badge className="bg-green-600 hover:bg-green-700">Update Available</Badge>
                                ) : (
                                    <Badge variant="secondary">Installed</Badge>
                                )}
                            </CardDescription>
                        </div>
                        {details?.homepage && (
                            <Button variant="ghost" asChild>
                                <a href={details.homepage} target="_blank" rel="noopener noreferrer">Visit Homepage</a>
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div>
                        <h3 className="text-sm font-semibold mb-2">Description</h3>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed bg-muted/30 p-4 rounded-md border">
                            {details?.description}
                        </p>
                    </div>

                    <div className="grid gap-2">
                        <h3 className="text-sm font-semibold">Raw Details</h3>
                        <div className="max-h-64 overflow-y-auto bg-black text-xs font-mono p-4 rounded-md text-green-400">
                            {details?.raw}
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-2 border-t p-6 bg-muted/5">
                    {isSystemUpdate ? (
                        <Button onClick={handleUpdate} disabled={isUpdating}>
                            {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowUpCircle className="mr-2 h-4 w-4" />}
                            Update Package
                        </Button>
                    ) : (
                        <Button onClick={handleUpdate} variant="outline" disabled={isUpdating} title="Reinstall or ensure latest version">
                            {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                            Reinstall / Update
                        </Button>
                    )}
                </CardFooter>
            </Card>
        </div>
    );
}
