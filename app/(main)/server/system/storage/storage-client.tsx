'use client';

import { useState, useEffect } from 'react';
import { getStorageInfo } from '@/services/server/system-storage';
import type { StorageInfo, StorageSection } from '@/services/server/system-storage';
import { useToast } from '@/core/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    HardDrive,
    Users,
    Cpu,
    Layers,
    Database,
    RotateCcw,
    CheckCircle2,
    AlertTriangle,
} from 'lucide-react';
import { cn } from '@/core/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBytes(bytes: number): string {
    if (bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.floor(Math.log2(bytes) / 10), units.length - 1);
    const val = bytes / Math.pow(1024, i);
    return `${val % 1 === 0 ? val : val.toFixed(1)} ${units[i]}`;
}

function pct(used: number, total: number) {
    if (!total) return 0;
    return Math.min(100, Math.round((used / total) * 100));
}

function barColor(p: number) {
    if (p >= 90) return 'bg-red-500';
    if (p >= 70) return 'bg-yellow-500';
    return 'bg-blue-500';
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function UsageBar({ used, total, className }: { used: number; total: number; className?: string }) {
    const p = pct(used, total);
    return (
        <div className={cn('h-1.5 w-full rounded-full bg-muted overflow-hidden', className)}>
            {/* eslint-disable-next-line react/forbid-dom-props */}
            <div className={cn('h-full rounded-full transition-all', barColor(p))} style={{ width: `${p}%` }} />
        </div>
    );
}

// ─── Section icon map ─────────────────────────────────────────────────────────

function sectionIcon(label: string) {
    if (label === 'System') return <Cpu className="h-5 w-5 text-muted-foreground" />;
    if (label === 'User Accounts') return <Users className="h-5 w-5 text-muted-foreground" />;
    if (label === 'Logs') return <Layers className="h-5 w-5 text-muted-foreground" />;
    if (label === 'Temporary Files') return <HardDrive className="h-5 w-5 text-muted-foreground" />;
    return <Database className="h-5 w-5 text-muted-foreground" />;
}

// ─── Disk Overview Card ───────────────────────────────────────────────────────

function DiskOverviewCard({ disk, swap }: { disk: StorageInfo['disk']; swap: StorageInfo['swap'] }) {
    const diskPct = pct(disk.usedBytes, disk.totalBytes);
    const swapPct = pct(swap.usedBytes, swap.totalBytes);

    return (
        <div className="space-y-4">
            <h3 className="text-xl font-semibold px-1">Disk Overview</h3>
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">

                {/* Root filesystem */}
                <div className="flex items-center gap-4 p-4 border-b">
                    <div className={cn(
                        'h-10 w-10 rounded-full flex items-center justify-center shrink-0',
                        diskPct >= 90 ? 'bg-red-50 dark:bg-red-950' :
                        diskPct >= 70 ? 'bg-yellow-50 dark:bg-yellow-950' :
                        'bg-blue-50 dark:bg-blue-950'
                    )}>
                        {diskPct >= 90
                            ? <AlertTriangle className="h-5 w-5 text-red-500" />
                            : <HardDrive className={cn('h-5 w-5', diskPct >= 70 ? 'text-yellow-500' : 'text-blue-500')} />
                        }
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1.5">
                            <h4 className="text-base font-medium">Root Filesystem</h4>
                            <span className="text-sm text-muted-foreground shrink-0 ml-4">
                                {fmtBytes(disk.usedBytes)} / {fmtBytes(disk.totalBytes)}
                            </span>
                        </div>
                        <UsageBar used={disk.usedBytes} total={disk.totalBytes} />
                        <p className="text-xs text-muted-foreground mt-1.5">
                            {fmtBytes(disk.availableBytes)} remaining · {diskPct}% used
                        </p>
                    </div>
                </div>

                {/* Swap */}
                <div className="flex items-center gap-4 p-4">
                    <div className={cn(
                        'h-10 w-10 rounded-full flex items-center justify-center shrink-0',
                        swap.totalBytes === 0 ? 'bg-muted' : 'bg-purple-50 dark:bg-purple-950'
                    )}>
                        <Layers className={cn('h-5 w-5', swap.totalBytes === 0 ? 'text-muted-foreground' : 'text-purple-500')} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1.5">
                            <h4 className="text-base font-medium">Swap Space</h4>
                            {swap.totalBytes > 0 ? (
                                <span className="text-sm text-muted-foreground shrink-0 ml-4">
                                    {fmtBytes(swap.usedBytes)} / {fmtBytes(swap.totalBytes)}
                                </span>
                            ) : (
                                <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground shrink-0 ml-4">
                                    not configured
                                </span>
                            )}
                        </div>
                        {swap.totalBytes > 0 ? (
                            <>
                                <UsageBar used={swap.usedBytes} total={swap.totalBytes} />
                                <p className="text-xs text-muted-foreground mt-1.5">
                                    {fmtBytes(swap.totalBytes - swap.usedBytes)} free · {swapPct}% used
                                </p>
                            </>
                        ) : (
                            <p className="text-sm text-muted-foreground">No swap space is active on this server.</p>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}

// ─── Space Breakdown Card ─────────────────────────────────────────────────────

function SpaceBreakdownCard({ sections, diskTotal }: { sections: StorageSection[]; diskTotal: number }) {
    const available = sections.filter((s) => s.available);
    const notInstalled = sections.filter((s) => !s.available);

    return (
        <div className="space-y-4">
            <h3 className="text-xl font-semibold px-1">Space Breakdown</h3>
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
                {available.map((section, i) => {
                    const p = pct(section.usedBytes, diskTotal);
                    return (
                        <div
                            key={section.label}
                            className={cn(
                                'flex items-center gap-4 p-4 transition-all hover:bg-muted/50',
                                i !== available.length - 1 && 'border-b'
                            )}
                        >
                            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                                {sectionIcon(section.label)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1.5">
                                    <h4 className="text-base font-medium">{section.label}</h4>
                                    <span className="text-sm text-muted-foreground shrink-0 ml-4">
                                        {fmtBytes(section.usedBytes)}
                                        <span className="text-xs ml-1 opacity-60">({p}%)</span>
                                    </span>
                                </div>
                                <UsageBar used={section.usedBytes} total={diskTotal} />
                            </div>
                        </div>
                    );
                })}

                {notInstalled.length > 0 && (
                    <>
                        {available.length > 0 && <div className="border-t" />}
                        {notInstalled.map((section, i) => (
                            <div
                                key={section.label}
                                className={cn(
                                    'flex items-center gap-4 p-4 opacity-50',
                                    i !== notInstalled.length - 1 && 'border-b'
                                )}
                            >
                                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                                    {sectionIcon(section.label)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-base font-medium">{section.label}</h4>
                                    <p className="text-sm text-muted-foreground">Not installed</p>
                                </div>
                                <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                                    not found
                                </span>
                            </div>
                        ))}
                    </>
                )}
            </div>
        </div>
    );
}

// ─── Remaining Space Card ─────────────────────────────────────────────────────

function RemainingSpaceCard({ disk }: { disk: StorageInfo['disk'] }) {
    const p = pct(disk.availableBytes, disk.totalBytes);
    const usedPct = pct(disk.usedBytes, disk.totalBytes);

    return (
        <div className="space-y-4">
            <h3 className="text-xl font-semibold px-1">Remaining Space</h3>
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
                <div className="flex items-center gap-4 p-4">
                    <div className={cn(
                        'h-10 w-10 rounded-full flex items-center justify-center shrink-0',
                        p <= 10 ? 'bg-red-50 dark:bg-red-950' :
                        p <= 30 ? 'bg-yellow-50 dark:bg-yellow-950' :
                        'bg-green-50 dark:bg-green-950'
                    )}>
                        <CheckCircle2 className={cn(
                            'h-5 w-5',
                            p <= 10 ? 'text-red-500' :
                            p <= 30 ? 'text-yellow-500' :
                            'text-green-500'
                        )} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1.5">
                            <h4 className="text-base font-medium">Available</h4>
                            <span className="text-sm font-semibold shrink-0 ml-4">
                                {fmtBytes(disk.availableBytes)}
                                <span className="font-normal text-muted-foreground ml-1">of {fmtBytes(disk.totalBytes)}</span>
                            </span>
                        </div>
                        {/* Stacked bar: used + free */}
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden flex">
                            {/* eslint-disable-next-line react/forbid-dom-props */}
                            <div className={cn('h-full transition-all', barColor(usedPct))} style={{ width: `${usedPct}%` }} />
                            {/* eslint-disable-next-line react/forbid-dom-props */}
                            <div className="h-full bg-green-400 transition-all" style={{ width: `${p}%` }} />
                        </div>
                        <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                                <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
                                Used {usedPct}%
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="inline-block h-2 w-2 rounded-full bg-green-400" />
                                Free {p}%
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function StorageSkeleton() {
    return (
        <div className="space-y-8">
            {[1, 2, 3].map((s) => (
                <div key={s} className="space-y-4">
                    <Skeleton className="h-7 w-40" />
                    <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
                        {[1, 2].map((r) => (
                            <div key={r} className="flex items-center gap-4 p-4 border-b last:border-0">
                                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                                <div className="flex-1 space-y-2">
                                    <div className="flex justify-between">
                                        <Skeleton className="h-5 w-36" />
                                        <Skeleton className="h-5 w-24" />
                                    </div>
                                    <Skeleton className="h-1.5 w-full rounded-full" />
                                    <Skeleton className="h-3 w-48" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function StorageClient({
    serverId,
}: {
    serverId: string;
}) {
    const { toast } = useToast();
    const [data, setData] = useState<StorageInfo | undefined>(undefined);
    const [error, setError] = useState<string | undefined>(undefined);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = async (isRefresh = false) => {
        if (isRefresh) setIsRefreshing(true);
        try {
            const result = await getStorageInfo(serverId);
            if (result.error) {
                setError(result.error);
                if (isRefresh) toast({ variant: 'destructive', title: 'Refresh Failed', description: result.error });
            } else {
                setData(result.data);
                setError(undefined);
            }
        } catch (e: any) {
            setError(e.message);
            if (isRefresh) toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setIsLoading(false);
            if (isRefresh) setIsRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serverId]);

    const handleRefresh = () => fetchData(true);

    if (isLoading) {
        return <StorageSkeleton />;
    }

    if (isRefreshing && !data) {
        return <StorageSkeleton />;
    }

    if (error && !data) {
        return (
            <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
                <div className="flex items-center gap-4 p-4">
                    <div className="h-10 w-10 rounded-full bg-red-50 dark:bg-red-950 flex items-center justify-center shrink-0">
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                    </div>
                    <div className="flex-1">
                        <h4 className="text-base font-medium mb-1">Failed to load storage info</h4>
                        <p className="text-sm text-muted-foreground">{error}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
                        <RotateCcw className={cn('mr-1.5 h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
                        Retry
                    </Button>
                </div>
            </div>
        );
    }

    if (!data) return <StorageSkeleton />;

    return (
        <div className="space-y-8">
            <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isRefreshing} className="text-muted-foreground hover:text-foreground">
                    <RotateCcw className={cn('mr-1.5 h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
                    Refresh
                </Button>
            </div>

            <DiskOverviewCard disk={data.disk} swap={data.swap} />
            <SpaceBreakdownCard sections={data.sections} diskTotal={data.disk.totalBytes} />
            <RemainingSpaceCard disk={data.disk} />
        </div>
    );
}
