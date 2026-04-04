'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from "@/lib/utils";

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, HeartPulse, Server, Loader2, ChevronLeft, ChevronRight, Cpu, User, Hash, Search, XCircle, Globe, ArrowLeftRight } from "lucide-react";
import { startStatusTracking, stopStatusTracking, getStatus, type StatusData } from './actions';
import { getProcesses, killProcess, type Process } from '@/app/processes/actions';
import { getNetworkConnections, type NetworkConnection } from '@/app/network/actions';
import { useToast } from '@/hooks/use-toast';
import { PageTitleWithComponent } from '@/components/page-header';
import { Input } from '@/components/ui/input';
import {
    AreaChart,
    Area,
    ResponsiveContainer,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
} from "recharts";
import { format } from 'date-fns';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

const CustomTooltip = ({ active, payload, label, unit }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="rounded-lg border bg-background p-2 shadow-sm">
                <div className="grid grid-cols-1 gap-2">
                    <p className="text-sm text-muted-foreground">
                        {(() => {
                            const date = new Date(label);
                            return !isNaN(date.getTime()) ? format(date, "MMM d, h:mm a") : "";
                        })()}
                    </p>
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex flex-col">
                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                                {entry.name}
                            </span>
                            <span className="font-bold text-foreground">
                                {entry.value}{unit}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return null;
};

function ProcessesList({ processes, onKill }: { processes: Process[], onKill: (pid: string) => void }) {
    const [killingPid, setKillingPid] = useState<string | null>(null);

    const handleKillClick = async (pid: string) => {
        setKillingPid(pid);
        await onKill(pid);
        setKillingPid(null);
    };

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
                            <button
                                onClick={() => handleKillClick(process.pid)}
                                disabled={killingPid === process.pid}
                                className="flex items-center gap-1.5 shrink-0 text-red-500 hover:text-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {killingPid === process.pid ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <XCircle className="h-3.5 w-3.5" />
                                )}
                                <span className="font-medium">Kill</span>
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </Card>
    )
}

function NetworkList({ connections }: { connections: NetworkConnection[] }) {
    const getStatusColor = (status: string) => {
        const s = status.toUpperCase();
        if (s === 'LISTEN') return 'text-blue-500';
        if (s === 'ESTAB') return 'text-green-500';
        if (s === 'CLOSE_WAIT' || s === 'TIME_WAIT') return 'text-orange-500';
        return 'text-muted-foreground';
    };

    return (
        <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm">
            {connections.map((conn, index) => (
                <div key={`${conn.protocol}-${conn.port}-${conn.pid}-${index}`} className={cn(
                    "p-4 min-w-0 w-full transition-colors hover:bg-muted/50",
                    index !== connections.length - 1 && "border-b border-border"
                )}>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground break-all font-mono leading-tight mb-3">
                            {conn.process !== '-' ? conn.process : 'System / Unknown'}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1.5 shrink-0">
                                <Hash className="h-3.5 w-3.5" />
                                <span className="font-mono">{conn.port}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                <ArrowLeftRight className="h-3.5 w-3.5" />
                                <span>{conn.protocol}</span>
                            </div>
                            <div className={`flex items-center gap-1.5 shrink-0 ${getStatusColor(conn.state)}`}>
                                <Activity className="h-3.5 w-3.5" />
                                <span className="font-medium">{conn.state}</span>
                            </div>
                            {conn.state !== 'LISTEN' && (
                                <div className="flex items-center gap-1.5 shrink-0" title={`Peer: ${conn.peerAddress}`}>
                                    <Globe className="h-3.5 w-3.5" />
                                    <span className="font-mono truncate max-w-[150px]">{conn.peerAddress}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </Card>
    );
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

function NetworkLoadingSkeleton() {
    return (
        <div className="space-y-6">
            <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className={cn(
                        "p-4 min-w-0 w-full",
                        i !== 5 && "border-b border-border"
                    )}>
                        <div className="space-y-3">
                            <Skeleton className="h-4 w-1/3" />
                            <div className="flex gap-6">
                                <Skeleton className="h-3 w-12" />
                                <Skeleton className="h-3 w-12" />
                                <Skeleton className="h-3 w-16" />
                            </div>
                        </div>
                    </div>
                ))}
            </Card>
        </div>
    )
}

const TIME_FRAMES = {
    '1h': { label: 'Last 1 Hour', minutes: 60 },
    '24h': { label: 'Last 24 Hours', minutes: 1440 },
    '7d': { label: 'Last 7 Days', minutes: 10080 },
    '30d': { label: 'Last 30 Days', minutes: 43200 },
};

export default function StatusClient({ serverId, serverName }: { serverId?: string, serverName?: string }) {
    const { toast } = useToast();
    const router = useRouter();
    const [statusData, setStatusData] = useState<StatusData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isToggling, setIsToggling] = useState(false);

    const [processes, setProcesses] = useState<Process[]>([]);
    const [isProcessesLoading, setIsProcessesLoading] = useState(false);
    const [processesSearch, setProcessesSearch] = useState('');
    const [visibleProcessesCount, setVisibleProcessesCount] = useState(3);
    const [killingPid, setKillingPid] = useState<string | null>(null);

    const [connections, setConnections] = useState<NetworkConnection[]>([]);
    const [isNetworkLoading, setIsNetworkLoading] = useState(false);
    const [networkSearch, setNetworkSearch] = useState('');
    const [visibleConnectionsCount, setVisibleConnectionsCount] = useState(3);

    const [endTime, setEndTime] = useState<number>(Date.now());
    const [timeFrame, setTimeFrame] = useState<keyof typeof TIME_FRAMES>('1h');

    useEffect(() => {
        if (!serverId) {
            setIsLoading(false);
            setIsProcessesLoading(false);
            setIsNetworkLoading(false);
            return;
        };

        const fetchStatus = async () => {
            setIsLoading(true);
            const duration = TIME_FRAMES[timeFrame].minutes;
            const { data, error } = await getStatus(serverId, endTime, duration);
            if (error) {
                toast({ variant: 'destructive', title: 'Error', description: error });
                setStatusData(null);
            } else if (data) {
                setStatusData(data);
            }
            setIsLoading(false);
        }
        fetchStatus();
    }, [serverId, toast, endTime, timeFrame]);

    useEffect(() => {
        if (!serverId) {
            setIsProcessesLoading(false);
            return;
        }
        
        const fetchProcesses = async () => {
            setIsProcessesLoading(true);
            try {
                const result = await getProcesses(serverId);
                if (result.error) {
                    toast({ variant: 'destructive', title: 'Error', description: result.error });
                    setProcesses([]);
                } else {
                    setProcesses(Array.isArray(result.processes) ? result.processes : []);
                }
            } catch (error: any) {
                toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch processes' });
                setProcesses([]);
            } finally {
                setIsProcessesLoading(false);
            }
        };
        
        fetchProcesses();
    }, [serverId, toast]);

    useEffect(() => {
        setVisibleProcessesCount(3);
    }, [processesSearch, serverId]);

    useEffect(() => {
        if (!serverId) {
            setIsNetworkLoading(false);
            return;
        }
        
        const fetchNetwork = async () => {
            setIsNetworkLoading(true);
            try {
                const result = await getNetworkConnections(serverId);
                if (result.error) {
                    toast({ variant: 'destructive', title: 'Error', description: result.error });
                    setConnections([]);
                } else {
                    setConnections(Array.isArray(result.connections) ? result.connections : []);
                }
            } catch (error: any) {
                toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch network connections' });
                setConnections([]);
            } finally {
                setIsNetworkLoading(false);
            }
        };
        
        fetchNetwork();
    }, [serverId, toast]);

    useEffect(() => {
        setVisibleConnectionsCount(3);
    }, [networkSearch, serverId]);

    const handleKillProcess = async (pid: string) => {
        setKillingPid(pid);
        try {
            await killProcess(serverId || '', pid);
            setProcesses(prev => prev.filter(p => p.pid !== pid));
            toast({ title: 'Process terminated' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to kill process' });
        } finally {
            setKillingPid(null);
        }
    };

    const handleToggleTracking = async () => {
        if (!serverId) return;

        if (!statusData?.isTracking) {
            router.push('/server/system/requirement/system-logger');
            return;
        }

        setIsToggling(true);

        let result;
        if (statusData?.isTracking) {
            result = await stopStatusTracking(serverId);
            toast({ title: 'Status Tracking Stopped' });
        } else {
            result = await startStatusTracking(serverId);
            toast({ title: 'Status Tracking Started', description: 'It may take a few minutes for data to appear.' });
        }

        if (result.error) {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        } else {
            // Refresh data
            const duration = TIME_FRAMES[timeFrame].minutes;
            const { data } = await getStatus(serverId, endTime, duration);
            setStatusData(data || null);
        }

        setIsToggling(false);
    }

    const handlePreviousTime = () => {
        const duration = TIME_FRAMES[timeFrame].minutes * 60 * 1000;
        setEndTime(prev => prev - duration);
    };

    const handleNextTime = () => {
        const duration = TIME_FRAMES[timeFrame].minutes * 60 * 1000;
        setEndTime(prev => Math.min(prev + duration, Date.now()));
    };

    const isCurrentTime = endTime >= Date.now() - 1000; // tolerance

    const calculateAverage = (data: any[], key: string) => {
        if (!data || data.length === 0) return 0;
        const sum = data.reduce((acc, curr) => acc + curr[key], 0);
        return (sum / data.length).toFixed(1);
    };

    const avgCpu = statusData ? calculateAverage(statusData.cpuHistory, 'usage') : 0;
    const avgRam = statusData ? calculateAverage(statusData.ramHistory, 'used') : 0; // Avg used MB
    const totalRam = statusData?.ramHistory[0]?.total || 0;
    const avgRamPercent = totalRam > 0 ? ((Number(avgRam) / totalRam) * 100).toFixed(1) : 0;

    const filteredProcesses = (Array.isArray(processes) ? processes : []).filter(p =>
        p.name.toLowerCase().includes(processesSearch.toLowerCase()) ||
        p.user.toLowerCase().includes(processesSearch.toLowerCase()) ||
        p.pid.toString().includes(processesSearch)
    );

    const filteredConnections = (Array.isArray(connections) ? connections : []).filter(conn =>
        (conn.process || '').toLowerCase().includes(networkSearch.toLowerCase()) ||
        conn.port.toString().includes(networkSearch) ||
        conn.protocol.toLowerCase().includes(networkSearch.toLowerCase()) ||
        (conn.peerAddress || '').toLowerCase().includes(networkSearch.toLowerCase()) ||
        conn.state.toLowerCase().includes(networkSearch.toLowerCase())
    );

    const visibleProcesses = filteredProcesses.slice(0, visibleProcessesCount);
    const visibleConnections = filteredConnections.slice(0, visibleConnectionsCount);

    const startTime = new Date(endTime - TIME_FRAMES[timeFrame].minutes * 60 * 1000);

    return (
        <div className="grid gap-6">
            {/* Page Title with Controls */}
            {/* Page Title */}
            <PageTitleWithComponent
                title="Server Status"
                description="Historical and real-time performance indicators"
                serverName={serverName}
                actionComponent={undefined}
            />
            {/* Date/Time Controls */}
            {serverId && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full">
                    {/* Date Navigator */}
                    <div className="flex items-center gap-1 bg-card p-1 rounded-md border shadow-sm w-full sm:w-auto justify-between sm:justify-start">
                        <Button variant="ghost" size="icon" onClick={handlePreviousTime} className="h-8 w-8">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="px-2 text-xs sm:text-sm font-medium text-center truncate">
                            {format(startTime, "MMM d, h:mm a")} - {format(new Date(endTime), "MMM d, h:mm a")}
                        </div>
                        <Button variant="ghost" size="icon" onClick={handleNextTime} disabled={isCurrentTime} className="h-8 w-8">
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Timeframe Tabs */}
                    <div className="flex items-center p-1 bg-muted/50 rounded-lg border w-full sm:w-auto">
                        {Object.entries(TIME_FRAMES).map(([key, { label }]) => (
                            <button
                                key={key}
                                onClick={() => setTimeFrame(key as any)}
                                className={cn(
                                    "flex-1 sm:flex-none px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                                    timeFrame === key
                                        ? "bg-background text-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                                )}
                            >
                                {key.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            {!serverId ? (
                <Card className="text-center p-8">
                    <Server className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-medium">No Server Selected</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Please go to the servers page and select a server to manage.
                    </p>
                    <Button asChild className="mt-4">
                        <Link href="/servers">Go to Servers</Link>
                    </Button>
                </Card>
            ) : isLoading ? (
                <div className="grid gap-6">
                    {[1, 2, 3].map((i) => (
                        <Card key={i}>
                            <CardHeader className="space-y-2">
                                <Skeleton className="h-6 w-1/3" />
                                <Skeleton className="h-4 w-1/4" />
                            </CardHeader>
                            <CardContent className="h-[250px] w-full pt-0">
                                <Skeleton className="h-full w-full rounded-md" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="grid gap-6">
                    {!statusData?.isTracking ? (
                        <Card className="border-primary/20 bg-primary/5 py-8">
                            <CardHeader className="flex flex-col items-center text-center space-y-4">
                                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                                    <Activity className="h-8 w-8 text-primary animate-pulse" />
                                </div>
                                <div className="space-y-2">
                                    <CardTitle className="text-2xl font-headline text-primary">Status Monitoring Required</CardTitle>
                                    <CardDescription className="text-base text-primary/70 max-w-md">
                                        Performance logging is not currently active. Enable the system logger to start recording real-time performance metrics and history.
                                    </CardDescription>
                                </div>
                                <Button
                                    onClick={handleToggleTracking}
                                    size="lg"
                                    className="mt-4 px-8 shadow-xl hover:shadow-primary/20 transition-all active:scale-95"
                                >
                                    Enable Monitoring
                                </Button>
                            </CardHeader>
                        </Card>
                    ) : (
                        <div className="grid gap-6">
                            <Card>
                                <CardHeader>
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <CardTitle className="font-headline">CPU Usage History</CardTitle>
                                            <CardDescription>
                                                Average for selected period: <span className="font-semibold text-foreground">{avgCpu}%</span>
                                            </CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="h-[250px] w-full">
                                    {statusData && statusData.cpuHistory.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={statusData.cpuHistory} margin={{ top: 5, right: 20, left: -20, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                                                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                                <Tooltip content={<CustomTooltip unit="%" />} />
                                                <Area type="monotone" dataKey="usage" name="CPU" strokeWidth={2} stroke="hsl(var(--primary))" fill="url(#colorCpu)" />
                                                <XAxis
                                                    dataKey="timestamp"
                                                    stroke="hsl(var(--muted-foreground))"
                                                    fontSize={12}
                                                    tickLine={false}
                                                    axisLine={false}
                                                    tickFormatter={(value) => {
                                                        const date = new Date(value);
                                                        if (isNaN(date.getTime())) return "";
                                                        return format(date, timeFrame === '1h' ? "h:mm a" : "MMM d");
                                                    }}
                                                    interval="preserveStartEnd"
                                                    minTickGap={30}
                                                />
                                                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="flex justify-center items-center h-full text-muted-foreground">No CPU data available for this period.</div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <CardTitle className="font-headline">RAM Usage History</CardTitle>
                                            <CardDescription>
                                                Average for selected period: <span className="font-semibold text-foreground">{avgRamPercent}% ({avgRam}MB)</span>
                                            </CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="h-[250px] w-full">
                                    {statusData && statusData.ramHistory.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={statusData.ramHistory} margin={{ top: 5, right: 20, left: -20, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="colorRamUsed" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.8} />
                                                        <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                                                    </linearGradient>
                                                    <linearGradient id="colorRamTotal" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.2} />
                                                        <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.05} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                                <Tooltip content={<CustomTooltip unit="MB" />} />
                                                <Area type="monotone" dataKey="total" name="Total RAM" strokeWidth={1} stroke="hsl(var(--muted-foreground))" fill="url(#colorRamTotal)" fillOpacity={0.3} />
                                                <Area type="monotone" dataKey="used" name="Used RAM" strokeWidth={2} stroke="hsl(var(--accent))" fill="url(#colorRamUsed)" />
                                                <XAxis
                                                    dataKey="timestamp"
                                                    stroke="hsl(var(--muted-foreground))"
                                                    fontSize={12}
                                                    tickLine={false}
                                                    axisLine={false}
                                                    tickFormatter={(value) => {
                                                        const date = new Date(value);
                                                        if (isNaN(date.getTime())) return "";
                                                        return format(date, timeFrame === '1h' ? "h:mm a" : "MMM d");
                                                    }}
                                                    interval="preserveStartEnd"
                                                    minTickGap={30}
                                                />
                                                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}MB`} domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.1)]} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="flex justify-center items-center h-full text-muted-foreground">No RAM data available for this period.</div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <CardTitle className="font-headline">Network Traffic</CardTitle>
                                            <CardDescription>
                                                Bandwidth usage (Incoming/Outgoing) per minute
                                            </CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="h-[250px] w-full">
                                    {statusData && statusData.networkHistory && statusData.networkHistory.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={statusData.networkHistory} margin={{ top: 5, right: 20, left: -20, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="colorNetRx" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8} />
                                                        <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                                                    </linearGradient>
                                                    <linearGradient id="colorNetTx" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.8} />
                                                        <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                                <Tooltip content={<CustomTooltip unit="MB" />} />
                                                <Area type="monotone" dataKey="incoming" name="Incoming" strokeWidth={2} stroke="hsl(var(--chart-1))" fill="url(#colorNetRx)" />
                                                <Area type="monotone" dataKey="outgoing" name="Outgoing" strokeWidth={2} stroke="hsl(var(--chart-2))" fill="url(#colorNetTx)" />
                                                <XAxis
                                                    dataKey="timestamp"
                                                    stroke="hsl(var(--muted-foreground))"
                                                    fontSize={12}
                                                    tickLine={false}
                                                    axisLine={false}
                                                    tickFormatter={(value) => {
                                                        const date = new Date(value);
                                                        if (isNaN(date.getTime())) return "";
                                                        return format(date, timeFrame === '1h' ? "h:mm a" : "MMM d");
                                                    }}
                                                    interval="preserveStartEnd"
                                                    minTickGap={30}
                                                />
                                                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}MB`} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="flex justify-center items-center h-full text-muted-foreground">No Network data available for this period.</div>
                                    )}
                                </CardContent>
                            </Card>

                            <div className="grid gap-6 md:grid-cols-2">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="font-headline">Processes</CardTitle>
                                        <CardDescription>View and manage running processes in a dedicated page.</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <Button asChild className="w-full">
                                            <Link href="/server/status/processes">Open Processes</Link>
                                        </Button>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle className="font-headline">Network Connections</CardTitle>
                                        <CardDescription>Inspect active network sessions and listeners in a dedicated page.</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <Button asChild className="w-full">
                                            <Link href="/server/status/network">Open Network</Link>
                                        </Button>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
