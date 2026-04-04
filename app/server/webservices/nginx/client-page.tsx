'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getNginxConfigurations, type WebServiceConfig } from '@/app/server/webservices/actions';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, FileCode, Calendar, User, Server, Hash, RefreshCw, Shield, CheckCircle } from 'lucide-react';
import { PageTitleBack } from '@/components/page-header';
import { cn } from '@/lib/utils';
import { restartNginxService } from './restart-action';
import { testNginxConfiguration } from './test-action';
import { useToast } from '@/hooks/use-toast';

export default function NginxConfigurationsPage() {
    const [configurations, setConfigurations] = useState<WebServiceConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [restarting, setRestarting] = useState(false);
    const [testing, setTesting] = useState(false);
    const { toast } = useToast();

    const handleTest = async () => {
        setTesting(true);
        try {
            const result = await testNginxConfiguration();
            if (result.success) {
                toast({
                    title: "Test Passed",
                    description: result.message || "Nginx configuration is valid.",
                    className: "bg-green-600 border-green-700 text-white",
                });
            } else {
                toast({
                    title: "Test Failed",
                    description: result.error || "Configuration has errors.",
                    variant: "destructive",
                });
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "An unexpected error occurred.",
                variant: "destructive",
            });
        } finally {
            setTesting(false);
        }
    };

    const handleRestart = async () => {
        setRestarting(true);
        try {
            const result = await restartNginxService();
            if (result.success) {
                toast({
                    title: "Success",
                    description: "Nginx service restarted successfully.",
                    className: "bg-green-600 border-green-700 text-white",
                });
            } else {
                toast({
                    title: "Restart Failed",
                    description: result.error || "Failed to restart Nginx service.",
                    variant: "destructive",
                });
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "An unexpected error occurred.",
                variant: "destructive",
            });
        } finally {
            setRestarting(false);
        }
    };

    useEffect(() => {
        loadConfigurations();
    }, []);

    const loadConfigurations = async () => {
        setLoading(true);
        try {
            const configs = await getNginxConfigurations();
            setConfigurations(configs);
        } catch (error) {
            console.error('Error loading configurations:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp) return 'N/A';
        try {
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            return new Intl.DateTimeFormat('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }).format(date);
        } catch {
            return 'N/A';
        }
    };

    if (loading) {
        return (
            <div className="mr-auto w-full max-w-4xl space-y-8 animate-in fade-in duration-500 pb-20">
                <PageTitleBack
                    title="Nginx Configurations"
                    description="Manage your Nginx server configurations"
                    backHref="/server/webservices"
                />

                {/* Actions Skeleton */}
                <div className="space-y-4">
                    <div>
                        <Skeleton className="h-7 w-24 mb-2" />
                        <Skeleton className="h-4 w-64" />
                    </div>
                    <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
                        {/* Create skeleton */}
                        <div className="p-4 min-w-0 w-full flex items-center gap-4 border-b border-border">
                            <Skeleton className="h-9 w-9 rounded-full" />
                            <div className="flex-1">
                                <Skeleton className="h-5 w-48 mb-2" />
                                <Skeleton className="h-4 w-56" />
                            </div>
                        </div>
                        {/* Test skeleton */}
                        <div className="p-4 min-w-0 w-full flex items-center gap-4 border-b border-border">
                            <Skeleton className="h-9 w-9 rounded-full" />
                            <div className="flex-1">
                                <Skeleton className="h-5 w-40 mb-2" />
                                <Skeleton className="h-4 w-72" />
                            </div>
                        </div>
                        {/* Restart skeleton */}
                        <div className="p-4 min-w-0 w-full flex items-center gap-4">
                            <Skeleton className="h-9 w-9 rounded-full" />
                            <div className="flex-1">
                                <Skeleton className="h-5 w-44 mb-2" />
                                <Skeleton className="h-4 w-64" />
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Configurations Skeleton */}
                <div className="space-y-4">
                    <div>
                        <Skeleton className="h-7 w-32 mb-2" />
                        <Skeleton className="h-4 w-80" />
                    </div>
                    <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
                        {/* Default SSL skeleton */}
                        <div className="p-4 min-w-0 w-full flex items-center gap-4 border-b border-border">
                            <Skeleton className="h-9 w-9 rounded-full" />
                            <div className="flex-1">
                                <Skeleton className="h-5 w-52 mb-2" />
                                <Skeleton className="h-4 w-80" />
                            </div>
                        </div>
                        {/* Config items skeleton */}
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="p-4 min-w-0 w-full border-b border-border last:border-b-0">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <Skeleton className="h-4 w-4" />
                                        <Skeleton className="h-4 w-48" />
                                    </div>
                                    <Skeleton className="h-5 w-16" />
                                </div>
                                <div className="flex gap-6">
                                    <Skeleton className="h-3 w-32" />
                                    <Skeleton className="h-3 w-24" />
                                    <Skeleton className="h-3 w-20" />
                                </div>
                            </div>
                        ))}
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="mr-auto w-full max-w-4xl space-y-8 animate-in fade-in duration-500 pb-20">
            <PageTitleBack
                title="Nginx Configurations"
                description="Manage your Nginx server configurations"
                backHref="/server/webservices"
            />

            {/* Actions Card Set */}
            <div className="space-y-4">
                <div>
                    <h2 className="text-xl font-semibold tracking-tight">Actions</h2>
                    <p className="text-sm text-muted-foreground">Create, test, and restart Nginx configurations</p>
                </div>
                <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
                    {/* Create New Row */}
                    <Link href="/server/webservices/nginx/new" className="block">
                        <div className={cn(
                            "p-4 min-w-0 w-full transition-colors hover:bg-muted/50 flex items-center gap-4 text-primary",
                            "border-b border-border"
                        )}>
                            <div className="rounded-full bg-primary/10 p-2">
                                <Plus className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="font-semibold">Create New Configuration</p>
                                <p className="text-sm text-muted-foreground">Setup a new Nginx server block</p>
                            </div>
                        </div>
                    </Link>

                    {/* Test Configuration Row */}
                    <button
                        onClick={handleTest}
                        disabled={testing}
                        className="w-full text-left block hover:bg-blue-500/5 transition-colors"
                    >
                        <div className="p-4 min-w-0 w-full flex items-center gap-4 text-blue-600 dark:text-blue-500 border-b border-border">
                            <div className="rounded-full bg-blue-600/10 p-2">
                                <CheckCircle className={cn("h-5 w-5", testing && "animate-pulse")} />
                            </div>
                            <div>
                                <p className="font-semibold">{testing ? 'Testing Configuration...' : 'Test Configuration'}</p>
                                <p className="text-sm text-muted-foreground">Verify configuration correctness before restarting</p>
                            </div>
                        </div>
                    </button>

                    {/* Restart Server Row */}
                    <button
                        onClick={handleRestart}
                        disabled={restarting}
                        className="w-full text-left block hover:bg-red-500/5 transition-colors"
                    >
                        <div className="p-4 min-w-0 w-full flex items-center gap-4 text-destructive">
                            <div className="rounded-full bg-destructive/10 p-2">
                                <RefreshCw className={cn("h-5 w-5", restarting && "animate-spin")} />
                            </div>
                            <div>
                                <p className="font-semibold">{restarting ? 'Restarting Server...' : 'Restart Nginx Server'}</p>
                                <p className="text-sm text-muted-foreground">Apply changes by restarting the service</p>
                            </div>
                        </div>
                    </button>
                </Card>
            </div>

            {/* Configurations Card Set */}
            <div className="space-y-4">
                <div>
                    <h2 className="text-xl font-semibold tracking-tight">Configurations</h2>
                    <p className="text-sm text-muted-foreground">Manage default SSL and existing server configurations</p>
                </div>
                <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
                    {/* Default SSL Configuration */}
                    <Link href="/server/webservices/nginx/default" className="block">
                        <div className={cn(
                            "p-4 min-w-0 w-full transition-colors hover:bg-muted/50 flex items-center gap-4 text-orange-600 dark:text-orange-500",
                            configurations.length > 0 && "border-b border-border"
                        )}>
                            <div className="rounded-full bg-orange-600/10 p-2">
                                <Shield className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="font-semibold">Default SSL Configuration</p>
                                <p className="text-sm text-muted-foreground">Generate self-signed certificate and catch-all config</p>
                            </div>
                        </div>
                    </Link>

                    {/* Existing Configurations */}
                    {configurations.map((config, index) => (
                        <Link key={config.id} href={`/server/webservices/nginx/${config.id}`} className="block">
                            <div className={cn(
                                "p-4 min-w-0 w-full transition-colors hover:bg-muted/50",
                                index < configurations.length - 1 && "border-b border-border"
                            )}>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm font-medium text-foreground break-all font-mono leading-tight flex items-center gap-2">
                                            <FileCode className="h-4 w-4 text-muted-foreground" />
                                            {config.name || config.id || 'Unknown Configuration'}
                                        </p>
                                        <Badge variant="secondary" className="text-xs font-normal">
                                            {config.type.toUpperCase()}
                                        </Badge>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <Server className="h-3.5 w-3.5" />
                                            <span>{config.serverName || 'Unknown Server'}</span>
                                        </div>
                                        {config.isDraft && (
                                            <>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <Calendar className="h-3.5 w-3.5" />
                                                    <span>{formatDate(config.created_on)}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <Hash className="h-3.5 w-3.5" />
                                                    <span>{config.value?.pathRules?.length || 0} rules</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <User className="h-3.5 w-3.5" />
                                                    <span>{config.created_by}</span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}

                    {configurations.length === 0 && (
                        <div className="text-center py-6 text-muted-foreground border-t border-border">
                            <p className="text-sm">No existing configurations found.</p>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}
