
'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppStatusResult, checkApplicationStatus } from "@/app/server/applications/status-actions";
import { AlertCircle, Clock, Loader2, PlayCircle, StopCircle, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface StatusDashboardProps {
    applicationId: string;
}

export function StatusDashboard({ applicationId }: StatusDashboardProps) {
    const [status, setStatus] = useState<AppStatusResult | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchStatus = async () => {
        setIsLoading(true);
        try {
            const result = await checkApplicationStatus(applicationId);
            setStatus(result);
            setError(null);
        } catch (err) {
            console.error("Failed to fetch status:", err);
            setError("Failed to fetch status");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
        // Optional: Poll every 30 seconds
        const interval = setInterval(fetchStatus, 30000);
        return () => clearInterval(interval);
    }, [applicationId]);

    // Helper to render process card content
    const renderProcessStatus = () => {
        if (isLoading && !status) return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Checking...</div>;
        if (error) return <div className="flex items-center gap-2 text-destructive"><AlertCircle className="h-4 w-4" /> Error</div>;

        switch (status?.processStatus) {
            case 'running':
                return (
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2 text-green-500">
                            <PlayCircle className="h-5 w-5" />
                            <span className="text-2xl font-bold text-foreground">Running</span>
                        </div>
                        {status.metrics.memory && <p className="text-xs text-muted-foreground mt-1">Mem: {status.metrics.memory} | CPU: {status.metrics.cpu}</p>}
                    </div>
                );
            case 'error':
                return (
                    <div className="flex items-center gap-2 text-orange-500">
                        <AlertCircle className="h-5 w-5" />
                        <span className="text-2xl font-bold text-foreground">Crashed</span>
                    </div>
                );
            case 'stopped':
                return (
                    <div className="flex items-center gap-2 text-destructive">
                        <StopCircle className="h-5 w-5" />
                        <span className="text-2xl font-bold text-foreground">Stopped</span>
                    </div>
                );
            case 'not_running':
                return (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <StopCircle className="h-5 w-5" />
                        <span className="text-2xl font-bold text-foreground">Not Running</span>
                    </div>
                );
            default:
                return (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <AlertCircle className="h-5 w-5" />
                        <span className="text-2xl font-bold text-foreground">Not Running</span>
                    </div>
                );
        }
    };

    // Helper for Availability
    const renderAvailability = () => {
        if (isLoading && !status) return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Checking...</div>;

        if (status?.availability === 'active') {
            return (
                <div className="flex flex-col">
                    <div className="flex items-center gap-2 text-green-500">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                        </span>
                        <span className="text-2xl font-bold text-foreground">Active</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Health check passed</p>
                </div>
            );
        } else if (status?.availability === 'inactive') {
            return (
                <div className="flex flex-col">
                    <div className="flex items-center gap-2 text-destructive">
                        <XCircle className="h-5 w-5" />
                        <span className="text-2xl font-bold text-foreground">Unreachable</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Port Check Failed</p>
                </div>
            );
        } else {
            return (
                <div className="flex flex-col">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <AlertCircle className="h-5 w-5" />
                        <span className="text-2xl font-bold text-foreground">N/A</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Not monitored</p>
                </div>
            );
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {/* Process Status */}
            <Card className={cn(
                "transition-all duration-500",
                status?.processStatus === 'running' ? "bg-gradient-to-br from-card to-green-500/5 border-green-500/20" : ""
            )}>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Process</CardTitle>
                    {isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                </CardHeader>
                <CardContent>
                    {renderProcessStatus()}
                </CardContent>
            </Card>

            {/* Availability */}
            <Card className={cn(
                status?.availability === 'active' ? "bg-gradient-to-br from-card to-green-500/5 border-green-500/20" : ""
            )}>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Site Availability</CardTitle>
                </CardHeader>
                <CardContent>
                    {renderAvailability()}
                </CardContent>
            </Card>

            {/* Uptime */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Uptime</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading && !status ? (
                        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Checking...</div>
                    ) : (
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <Clock className="h-5 w-5 text-muted-foreground" />
                                <span className="text-2xl font-bold">{status?.uptime || '0m'}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Since last restart</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
