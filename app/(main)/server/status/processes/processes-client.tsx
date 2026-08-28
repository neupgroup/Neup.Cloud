'use client';

import { useState, useEffect } from 'react';
import { cn } from "#/core/utils";

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "#/components/ui/card";
import { Button } from "#/components/ui/button";
import { Skeleton } from "#/components/ui/skeleton";
import { Loader2, Hash, User, Cpu, XCircle, Search } from "lucide-react";
import { getProcesses, killProcess } from '@/services/processes/processes-service';
import type { Process } from '@/services/processes/types';
import { useToast } from '#/core/hooks/useToast';
import { Input } from '#/components/ui/input';

function ProcessesList({ processes, onKill, killingPid }: { processes: Process[], onKill: (pid: string) => void, killingPid: string | null }) {
    return (
        <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm">
            {processes.map((process, index) => (
                <div key={process.pid} className={cn(
                    "p-4 min-w-0 w-full transition-colors hover:bg-muted/50",
                    index !== processes.length - 1 && "border-b border-border"
                )}>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground break-all font-mono leading-tight mb-3">
                            {process.name}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1.5 shrink-0">
                                <Hash className="h-3.5 w-3.5" />
                                <span className="font-mono">{process.pid}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                <User className="h-3.5 w-3.5" />
                                <span>{process.user}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                <Cpu className="h-3.5 w-3.5" />
                                <span className="font-medium">{process.cpu} CPU</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-memory-stick"><path d="M6 3v18" /><path d="M18 3v18" /><path d="M6 9h12" /><path d="M6 15h12" /><path d="M9 3v18" /><path d="M15 3v18" /></svg>
                                <span className="font-medium">{process.memory}% RAM</span>
                            </div>
                            <Button
                                onClick={() => onKill(process.pid)}
                                disabled={killingPid === process.pid}
                                className="flex items-center gap-1.5 shrink-0 text-red-500 hover:text-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {killingPid === process.pid ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <XCircle className="h-3.5 w-3.5" />
                                )}
                                <span className="font-medium">Kill</span>
                            </Button>
                        </div>
                    </div>
                </div>
            ))}
        </Card>
    )
}

function ProcessesLoadingSkeleton() {
    return (
        <div className="space-y-6">
            <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm">
                {[...Array(9)].map((_, i) => (
                    <div key={i} className={cn(
                        "p-4 min-w-0 w-full",
                        i !== 8 && "border-b border-border"
                    )}>
                        <div className="space-y-3">
                            <Skeleton className="h-4 w-full" />
                            <div className="flex gap-6">
                                <Skeleton className="h-3 w-16" />
                                <Skeleton className="h-3 w-16" />
                                <Skeleton className="h-3 w-16" />
                                <Skeleton className="h-3 w-16" />
                            </div>
                        </div>
                    </div>
                ))}
            </Card>
        </div>
    )
}

export default function ProcessesClient({
    serverId,
    onCountChange,
    showLoadMore = true,
    search: externalSearch,
    onSearchChange,
    showSearch = true,
}: {
    serverId: string;
    onCountChange?: (count: number) => void;
    showLoadMore?: boolean;
    search?: string;
    onSearchChange?: (value: string) => void;
    showSearch?: boolean;
}) {
    const { toast } = useToast();

    const [processes, setProcesses] = useState<Process[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [visibleCount, setVisibleCount] = useState(10);
    const [killingPid, setKillingPid] = useState<string | null>(null);
    const activeSearch = externalSearch ?? search;

    useEffect(() => {
        if (!serverId) {
            setIsLoading(false);
            return;
        }

        const fetchProcesses = async () => {
            setIsLoading(true);
            try {
                const result = await getProcesses(serverId);
                if (result.error) {
                    toast({ variant: 'destructive', title: 'Error', description: result.error });
                    setProcesses([]);
                } else {
                    const nextProcesses = Array.isArray(result.processes) ? result.processes : [];
                    setProcesses(nextProcesses);
                    onCountChange?.(nextProcesses.length);
                }
            } catch (error: any) {
                toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch processes' });
                setProcesses([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchProcesses();
    }, [serverId, toast]);

    useEffect(() => {
        setVisibleCount(10);
    }, [activeSearch, serverId]);

    const handleKillProcess = async (pid: string) => {
        if (!serverId) return;
        setKillingPid(pid);
        try {
            await killProcess(serverId, pid);
            setProcesses(prev => prev.filter(p => p.pid !== pid));
            toast({ title: 'Process terminated' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to kill process' });
        } finally {
            setKillingPid(null);
        }
    };

    const filteredProcesses = (Array.isArray(processes) ? processes : []).filter(p =>
        p.name.toLowerCase().includes(activeSearch.toLowerCase()) ||
        p.user.toLowerCase().includes(activeSearch.toLowerCase()) ||
        p.pid.toString().includes(activeSearch)
    );

    const visibleProcesses = filteredProcesses.slice(0, visibleCount);

    return (
        <div className="grid gap-6">
            {isLoading ? (
                <ProcessesLoadingSkeleton />
            ) : processes.length === 0 ? (
                <Card className="text-center p-8">
                    <p className="text-sm text-muted-foreground">No processes found</p>
                </Card>
            ) : (
                <>
                    {showSearch && <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by process name, user, or PID..."
                            type="text"
                            value={activeSearch}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                onSearchChange?.(e.target.value);
                            }}
                            className="pl-10"
                        />
                    </div>}

                    {visibleProcesses.length > 0 ? (
                        <>
                            <ProcessesList 
                                processes={visibleProcesses} 
                                onKill={handleKillProcess}
                                killingPid={killingPid}
                            />

                            {showLoadMore && visibleProcesses.length < filteredProcesses.length && (
                                <div className="text-center">
                                    <Button
                                        type="outlined"
                                        onClick={() => setVisibleCount(prev => prev + 10)}
                                    >
                                        Load More ({filteredProcesses.length - visibleCount} remaining)
                                    </Button>
                                </div>
                            )}
                        </>
                    ) : (
                        <Card className="text-center p-8">
                            <p className="text-sm text-muted-foreground">No processes match your search</p>
                        </Card>
                    )}
                </>
            )}
        </div>
    );
}
