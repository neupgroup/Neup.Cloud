'use client';

import { Activity, Hash, CircleDot } from "lucide-react";
import { useEffect, useState } from "react";
import { getSupervisorProcesses } from "@/app/server/applications/actions";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface RunningProcessesCardProps {
    serverId: string;
}

export function RunningProcessesCard({ serverId }: RunningProcessesCardProps) {
    const [processes, setProcesses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchProcesses = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await getSupervisorProcesses();
            if ('error' in result && result.error === 'SUPERVISOR_NOT_INSTALLED') {
                setError("SUPERVISOR_NOT_INSTALLED");
            } else if (Array.isArray(result)) {
                // Limit to 5 items for the dashboard card
                setProcesses(result.slice(0, 5));
            } else {
                setProcesses([]);
            }
        } catch (err: any) {
            setError(err.message || "Failed to fetch processes");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (serverId) {
            fetchProcesses();
        }
    }, [serverId]);

    // Helper to determine status color and state
    const getProcessState = (proc: any) => {
        const status = proc.state;
        if (status === 'RUNNING') return 'green';
        if (status === 'STOPPED' || status === 'EXITED') return 'orange';
        if (status === 'FATAL' || status === 'BACKOFF' || status === 'stopped') return 'red';
        return 'gray';
    };

    if (!loading && (error || processes.length === 0)) {
        return null;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h2 className="text-xl font-bold tracking-tight">Running Processes</h2>
                    <p className="text-sm text-muted-foreground">Active applications managed by Supervisor.</p>
                </div>
            </div>

            {loading ? (
                <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="p-4 border-b border-border last:border-0">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="space-y-3 flex-1">
                                    <div className="flex items-center gap-3">
                                        <Skeleton className="h-2.5 w-2.5 rounded-full" />
                                        <Skeleton className="h-4 w-1/3 max-w-[150px]" />
                                    </div>
                                    <div className="flex gap-4 pl-5">
                                        <Skeleton className="h-3 w-16" />
                                        <Skeleton className="h-3 w-16" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </Card>
            ) : (
                <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
                    {processes.map((proc: any, index: number) => {
                        const state = getProcessState(proc);
                        const uniqueId = proc.name;

                        const dotColor = {
                            green: 'bg-green-500',
                            blue: 'bg-blue-500',
                            orange: 'bg-orange-500',
                            red: 'bg-red-500',
                            gray: 'bg-slate-500'
                        }[state];

                        return (
                            <div
                                key={uniqueId}
                                className={cn(
                                    "block p-4 min-w-0 w-full",
                                    index !== processes.length - 1 && "border-b border-border"
                                )}
                            >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className={cn("h-2.5 w-2.5 rounded-full shrink-0 ring-2 ring-offset-2 ring-offset-card", dotColor, state === 'green' && "animate-pulse")} />
                                            <p className="text-sm font-medium text-foreground break-all font-mono leading-tight">
                                                {proc.name}
                                            </p>
                                            <Badge variant="outline" className="ml-2 text-[10px] px-1.5 h-5 border-slate-200 text-slate-500">
                                                Supervisor
                                            </Badge>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
                                            <div className="flex items-center gap-4 shrink-0 w-full text-xs">
                                                {proc.pid ? (
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        <Hash className="h-3 w-3" />
                                                        <span className="font-mono">PID: {proc.pid}</span>
                                                    </div>
                                                ) : null}
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <CircleDot className="h-3 w-3" />
                                                    <span className="capitalize">{proc.state}</span>
                                                </div>
                                                {proc.uptime ? (
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        <Activity className="h-3 w-3" />
                                                        <span className="font-medium">{proc.uptime}</span>
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </Card>
            )}
        </div>
    );
}
