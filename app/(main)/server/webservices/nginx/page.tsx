"use client";

import { useEffect, useState } from 'react';
import { LinkButton } from '@neup/components/ui/link-button';
import { getNginxConfigurations, type WebServiceConfig } from '@/services/webservices/service';
import { Card } from '@neup/components/ui/card';
import { Button } from '@neup/components/ui/button';
import { Badge } from '@neup/components/ui/badge';
import { Skeleton } from '@neup/components/ui/skeleton';
import { Plus, FileCode, Calendar, User, Server, Hash, RefreshCw, Shield, CheckCircle } from 'lucide-react';
import { PageTitleBack } from '@/components/page-header';
import { cn } from '@neup/core/utils';
import { restartNginxService } from './restart-action';
import { testNginxConfiguration } from './test-action';
import { useToast } from '@neup/core/hooks/useToast';
import { useSelectedServerId } from '@/hooks/use-selected-server';
import { withSelectedServerQuery } from '@/helpers/navigation';

export default function NginxConfigurationsPage() {
    const [configurations, setConfigurations] = useState<WebServiceConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [restarting, setRestarting] = useState(false);
    const [testing, setTesting] = useState(false);
    const { toast } = useToast();
    const selectedServerId = useSelectedServerId();

    const handleTest = async () => {
        setTesting(true);
        try {
            const result = await testNginxConfiguration(selectedServerId);
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
            const result = await restartNginxService(selectedServerId);
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
    }, [selectedServerId]);

    const loadConfigurations = async () => {
        setLoading(true);
        try {
            const configs = await getNginxConfigurations(selectedServerId);
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
                    backHref={withSelectedServerQuery('/server/webservices', selectedServerId)}
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

    const rowClassName = "h-auto min-h-20 w-full justify-start gap-4 whitespace-normal rounded-none border-0 p-4 text-left shadow-none focus-visible:ring-inset";

    return (
        <div className="mr-auto w-full max-w-4xl space-y-8 animate-in fade-in duration-500 pb-20">
            <PageTitleBack
                title="Nginx Configurations"
                description="Manage your Nginx server configurations"
                backHref={withSelectedServerQuery('/server/webservices', selectedServerId)}
            />

            {/* Actions Card Set */}
            <div className="space-y-4">
                <div>
                    <h2 className="text-xl font-semibold tracking-tight">Actions</h2>
                    <p className="text-sm text-muted-foreground">Create, test, and restart Nginx configurations</p>
                </div>
                <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
                    <LinkButton
                        href={withSelectedServerQuery('/server/webservices/nginx/new', selectedServerId)}
                        variant="plain"
                        alignment="left"
                        className={cn(rowClassName, 'border-b border-border text-primary')}
                    >
                        <span className="shrink-0 rounded-full bg-primary/10 p-2">
                            <Plus className="h-5 w-5" />
                        </span>
                        <span className="min-w-0 space-y-1">
                            <span className="block font-semibold">Create New Configuration</span>
                            <span className="block text-sm font-normal text-muted-foreground">Set up a new Nginx server block</span>
                        </span>
                    </LinkButton>

                    <Button
                        htmlType="button"
                        variant="plain"
                        alignment="left"
                        onClick={handleTest}
                        disabled={testing || restarting}
                        aria-busy={testing}
                        className={cn(rowClassName, 'border-b border-border text-blue-600 hover:bg-blue-500/5 dark:text-blue-500')}
                    >
                        <span className="shrink-0 rounded-full bg-blue-600/10 p-2">
                            <CheckCircle className={cn('h-5 w-5', testing && 'animate-pulse')} />
                        </span>
                        <span className="min-w-0 space-y-1">
                            <span className="block font-semibold">{testing ? 'Testing Configuration...' : 'Test Configuration'}</span>
                            <span className="block text-sm font-normal text-muted-foreground">Verify configuration correctness before restarting</span>
                        </span>
                    </Button>

                    <Button
                        htmlType="button"
                        variant="plain"
                        alignment="left"
                        onClick={handleRestart}
                        disabled={restarting || testing}
                        aria-busy={restarting}
                        className={cn(rowClassName, 'text-destructive hover:bg-red-500/5')}
                    >
                        <span className="shrink-0 rounded-full bg-destructive/10 p-2">
                            <RefreshCw className={cn('h-5 w-5', restarting && 'animate-spin')} />
                        </span>
                        <span className="min-w-0 space-y-1">
                            <span className="block font-semibold">{restarting ? 'Restarting Server...' : 'Restart Nginx Server'}</span>
                            <span className="block text-sm font-normal text-muted-foreground">Apply changes by restarting the service</span>
                        </span>
                    </Button>
                </Card>
            </div>

            {/* Configurations Card Set */}
            <div className="space-y-4">
                <div>
                    <h2 className="text-xl font-semibold tracking-tight">Configurations</h2>
                    <p className="text-sm text-muted-foreground">Manage default SSL and existing server configurations</p>
                </div>
                <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
                    <LinkButton
                        href={withSelectedServerQuery('/server/webservices/nginx/default', selectedServerId)}
                        variant="plain"
                        alignment="left"
                        className={cn(rowClassName, 'text-orange-600 dark:text-orange-500', configurations.length > 0 && 'border-b border-border')}
                    >
                        <span className="shrink-0 rounded-full bg-orange-600/10 p-2">
                            <Shield className="h-5 w-5" />
                        </span>
                        <span className="min-w-0 space-y-1">
                            <span className="block font-semibold">Default SSL Configuration</span>
                            <span className="block text-sm font-normal text-muted-foreground">Generate self-signed certificate and catch-all config</span>
                        </span>
                    </LinkButton>

                    {configurations.map((config, index) => (
                        <LinkButton
                            key={config.id}
                            href={withSelectedServerQuery(`/server/webservices/nginx/${config.id}`, selectedServerId)}
                            variant="plain"
                            alignment="left"
                            className={cn(rowClassName, index < configurations.length - 1 && 'border-b border-border')}
                        >
                            <span className="min-w-0 flex-1 space-y-2">
                                <span className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="flex min-w-0 items-center gap-2 break-all font-mono text-sm font-medium leading-tight text-foreground">
                                        <FileCode className="h-4 w-4 shrink-0 text-muted-foreground" />
                                        {config.name || config.id || 'Unknown Configuration'}
                                    </span>
                                    <Badge variant="secondary" className="shrink-0 text-xs font-normal">
                                        {config.type.toUpperCase()}
                                    </Badge>
                                </span>
                                <span className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-normal text-muted-foreground">
                                    <span className="flex min-w-0 items-center gap-1.5">
                                        <Server className="h-3.5 w-3.5 shrink-0" />
                                        <span className="break-all">{config.serverName || 'Unknown Server'}</span>
                                    </span>
                                    {config.isDraft && (
                                        <>
                                            <span className="flex items-center gap-1.5">
                                                <Calendar className="h-3.5 w-3.5" />
                                                {formatDate(config.created_on)}
                                            </span>
                                            <span className="flex items-center gap-1.5">
                                                <Hash className="h-3.5 w-3.5" />
                                                {config.value?.pathRules?.length || 0} rules
                                            </span>
                                            <span className="flex min-w-0 items-center gap-1.5">
                                                <User className="h-3.5 w-3.5 shrink-0" />
                                                <span className="break-all">{config.created_by}</span>
                                            </span>
                                        </>
                                    )}
                                </span>
                            </span>
                        </LinkButton>
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
