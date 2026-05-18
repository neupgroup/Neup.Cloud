'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { updateServer } from '@/services/server/server-service';
import { createRecurringSwap, deleteRecurringSwap, deleteSwapFile, listSwapFiles } from '@/services/server/system-swap';
import type { SwapFileEntry } from '@/services/server/system-swap';
import { SWAP_DIR } from '@/services/server/swap-paths';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/core/hooks/use-toast';
import {
    Zap,
    RefreshCw,
    HardDrive,
    Trash2,
    CheckCircle2,
    RotateCcw,
    Loader2,
    AlertTriangle,
} from 'lucide-react';
import { cn } from '@/core/utils';

type Props = {
    serverId: string;
    initialSwapSize: number;
    initialMoreDetails: string;
    initialRecurringSwapMb: number;
    initialSwapFiles: SwapFileEntry[];
};

function buildMoreDetails(existingMoreDetails: string, swapSizeMb: number) {
    const normalized = Number.isFinite(swapSizeMb) ? Math.max(0, Math.floor(swapSizeMb)) : 2048;
    try {
        const parsed = existingMoreDetails ? JSON.parse(existingMoreDetails) : {};
        return JSON.stringify({ ...parsed, swapSizeMb: normalized });
    } catch {
        return JSON.stringify({ swapSizeMb: normalized });
    }
}

function formatBytes(bytes: number) {
    if (!bytes) return null;
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb % 1 === 0 ? mb : mb.toFixed(0)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
}

// ─── Dynamic Swap Card ────────────────────────────────────────────────────────

function DynamicSwapCard({
    serverId,
    initialSwapSize,
    initialMoreDetails,
}: {
    serverId: string;
    initialSwapSize: number;
    initialMoreDetails: string;
}) {
    const router = useRouter();
    const { toast } = useToast();
    const [swapSize, setSwapSize] = useState(initialSwapSize);
    const [isSaving, setIsSaving] = useState(false);

    const isDisabled = initialSwapSize === 0;

    const handleSave = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await updateServer(serverId, {
                moreDetails: buildMoreDetails(initialMoreDetails, swapSize),
            });
            toast({
                title: 'Dynamic Swap Updated',
                description: swapSize === 0
                    ? 'Dynamic swap disabled — commands will run without a temporary swap file.'
                    : `Dynamic swap size saved as ${Math.floor(swapSize)} MB.`,
            });
            router.refresh();
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: err?.message });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-4">
            <h3 className="text-xl font-semibold px-1">Dynamic Swap</h3>
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">

                {/* Info row */}
                <div className="flex items-center gap-4 p-4 border-b">
                    <div className={cn(
                        'h-10 w-10 rounded-full flex items-center justify-center shrink-0',
                        isDisabled ? 'bg-muted' : 'bg-blue-50 dark:bg-blue-950'
                    )}>
                        <Zap className={cn('h-5 w-5', isDisabled ? 'text-muted-foreground' : 'text-blue-500')} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="text-base font-medium mb-1">Per-command swap</h4>
                        <p className="text-sm text-muted-foreground">
                            A temporary swap file is created before each command runs and deleted automatically when it finishes.
                            Set to <span className="font-mono">0</span> to disable.
                        </p>
                    </div>
                    {!isDisabled && (
                        <div className="shrink-0 px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            {initialSwapSize} MB
                        </div>
                    )}
                    {isDisabled && (
                        <div className="shrink-0 px-2 py-1 rounded text-xs font-medium bg-muted text-muted-foreground">
                            disabled
                        </div>
                    )}
                </div>

                {/* Action row */}
                <form onSubmit={handleSave}>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-muted/10 hover:bg-muted/20 transition-colors">
                        <div className="space-y-1 flex-1">
                            <h3 className="font-medium flex items-center gap-2">
                                <Zap className="h-4 w-4" />
                                Swap Size (MB)
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                Set to <span className="font-mono">0</span> to skip swap creation during command execution.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <Input
                                type="number"
                                min={0}
                                step={1}
                                value={swapSize}
                                onChange={(e) => setSwapSize(Number(e.target.value))}
                                placeholder="2048"
                                className="w-32"
                            />
                            <Button type="submit" size="sm" disabled={isSaving}>
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                            </Button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Persistent Swap Card ─────────────────────────────────────────────────────

function PersistentSwapCard({
    serverId,
    initialRecurringSwapMb,
}: {
    serverId: string;
    initialRecurringSwapMb: number;
}) {
    const router = useRouter();
    const { toast } = useToast();
    const [recurringMb, setRecurringMb] = useState(initialRecurringSwapMb);
    const [isApplying, setIsApplying] = useState(false);
    const [isRemoving, setIsRemoving] = useState(false);

    const isActive = initialRecurringSwapMb > 0;

    const handleApply = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (recurringMb === 0) {
            handleRemove();
            return;
        }
        setIsApplying(true);
        try {
            const result = await createRecurringSwap(serverId, recurringMb);
            if (result.error) {
                toast({ variant: 'destructive', title: 'Failed to Apply Swap', description: result.error });
            } else {
                toast({ title: 'Persistent Swap Applied', description: `${recurringMb} MB persistent swap is now active.` });
                router.refresh();
            }
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Error', description: err?.message });
        } finally {
            setIsApplying(false);
        }
    };

    const handleRemove = async () => {
        if (!confirm('Remove the persistent swap? It will be deleted and removed from startup.')) return;
        setIsRemoving(true);
        try {
            const result = await deleteRecurringSwap(serverId);
            if (result.error) {
                toast({ variant: 'destructive', title: 'Failed to Remove', description: result.error });
            } else {
                toast({ title: 'Persistent Swap Removed' });
                setRecurringMb(0);
                router.refresh();
            }
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Error', description: err?.message });
        } finally {
            setIsRemoving(false);
        }
    };

    const isBusy = isApplying || isRemoving;

    return (
        <div className="space-y-4">
            <h3 className="text-xl font-semibold px-1">Persistent Swap</h3>
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">

                {/* Info row */}
                <div className="flex items-center gap-4 p-4 border-b">
                    <div className={cn(
                        'h-10 w-10 rounded-full flex items-center justify-center shrink-0',
                        isActive ? 'bg-blue-50 dark:bg-blue-950' : 'bg-muted'
                    )}>
                        {isActive
                            ? <CheckCircle2 className="h-5 w-5 text-blue-500" />
                            : <RefreshCw className="h-5 w-5 text-muted-foreground" />
                        }
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="text-base font-medium mb-1">Recurring swap space</h4>
                        <p className="text-sm text-muted-foreground">
                            A dedicated swap file that persists across reboots. Registered at system startup automatically.
                        </p>
                    </div>
                    {isActive ? (
                        <div className="shrink-0 px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                            {initialRecurringSwapMb} MB active
                        </div>
                    ) : (
                        <div className="shrink-0 px-2 py-1 rounded text-xs font-medium bg-muted text-muted-foreground">
                            not set
                        </div>
                    )}
                </div>

                {/* Apply action row */}
                <form onSubmit={handleApply}>
                    <div
                        className={cn(
                            'flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 border-b bg-muted/10 transition-colors',
                            !isBusy && 'hover:bg-muted/20'
                        )}
                    >
                        <div className="space-y-1 flex-1">
                            <h3 className="font-medium flex items-center gap-2">
                                <RefreshCw className="h-4 w-4" />
                                {isActive ? 'Update Persistent Swap' : 'Set Persistent Swap'}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                Enter a size in MB. Set to <span className="font-mono">0</span> to remove it.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <Input
                                type="number"
                                min={0}
                                step={1}
                                value={recurringMb}
                                onChange={(e) => setRecurringMb(Number(e.target.value))}
                                placeholder="0"
                                className="w-32"
                                disabled={isBusy}
                            />
                            <Button type="submit" size="sm" disabled={isBusy}>
                                {isApplying
                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                    : isActive ? 'Update' : 'Apply'
                                }
                            </Button>
                        </div>
                    </div>
                </form>

                {/* Remove action row — only shown when active */}
                {isActive && (
                    <div
                        onClick={!isBusy ? handleRemove : undefined}
                        className={cn(
                            'flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t bg-destructive/5 transition-all',
                            !isBusy ? 'hover:bg-destructive/10 cursor-pointer' : 'opacity-60 cursor-not-allowed'
                        )}
                    >
                        <div className="space-y-1 text-center sm:text-left flex-1">
                            <h3 className="font-medium text-destructive flex items-center justify-center sm:justify-start gap-2">
                                <AlertTriangle className="h-4 w-4" />
                                {isRemoving ? 'Removing...' : 'Remove Persistent Swap'}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                Deletes the swap file and removes it from system startup.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Swap Files Card ──────────────────────────────────────────────────────────

function SwapFilesCard({
    serverId,
    initialSwapFiles,
}: {
    serverId: string;
    initialSwapFiles: SwapFileEntry[];
}) {
    const router = useRouter();
    const { toast } = useToast();
    const [swapFiles, setSwapFiles] = useState<SwapFileEntry[]>(initialSwapFiles);
	    const [deletingPath, setDeletingPath] = useState<string | null>(null);
	    const [isRefreshing, setIsRefreshing] = useState(false);

	    const handleDelete = async (path: string) => {
	        const file = swapFiles.find((f) => f.path === path);
	        if (!file) return;
	        if (file.kind === 'unknown') {
	            toast({
	                variant: 'destructive',
	                title: 'Cannot Delete',
	                description: 'This swap entry is not managed by Neup.Cloud and can’t be deleted from here.',
	            });
	            return;
	        }
	        const isPersistent = file?.kind === 'persistent';
	        const msg = isPersistent
	            ? 'Remove the persistent swap? It will be deleted and removed from startup.'
	            : file?.active
            ? 'This dynamic swap is currently active. Remove it anyway?'
            : 'Remove this unused dynamic swap file?';
        if (!confirm(msg)) return;

        setDeletingPath(path);
        try {
            const result = await deleteSwapFile(serverId, path);
            if (result.error) {
                toast({ variant: 'destructive', title: 'Failed to Delete', description: result.error });
            } else {
                toast({ title: 'Swap File Deleted' });
                setSwapFiles((prev) => prev.filter((f) => f.path !== path));
                router.refresh();
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setDeletingPath(null);
        }
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            const result = await listSwapFiles(serverId);
            if (result.error) {
                toast({ variant: 'destructive', title: 'Refresh Failed', description: result.error });
            } else {
                setSwapFiles(result.files);
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setIsRefreshing(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
                <h3 className="text-xl font-semibold">Swap Files</h3>
                <Button
                    variant="ghost"
                    size="sm"
                    disabled={isRefreshing}
                    onClick={handleRefresh}
                    className="text-muted-foreground hover:text-foreground"
                >
                    <RotateCcw className={cn('mr-1.5 h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
                    Refresh
                </Button>
            </div>

            <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
                {swapFiles.length === 0 ? (
                    <div className="flex items-center gap-4 p-4">
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <HardDrive className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1">
                            <h4 className="text-base font-medium mb-1">No swap files</h4>
                            <p className="text-sm text-muted-foreground">
                                No swap files have been created on this server yet.
                            </p>
                        </div>
                    </div>
	                ) : (
	                    swapFiles.map((file, index) => {
	                        const isPersistent = file.kind === 'persistent';
	                        const isUnknown = file.kind === 'unknown';
	                        const size = formatBytes(file.sizeBytes);
	                        const isDeleting = deletingPath === file.path;
	                        const baseName = file.path.split('/').pop() ?? '';
	                        const canDelete = file.path.startsWith(`${SWAP_DIR}/`)
	                            || file.path === '/swapfile_persistent'
	                            || baseName.startsWith('swapfile_cmd_');

	                        return (
	                            <div
	                                key={file.path}
                                className={cn(
                                    'flex items-center gap-4 p-4 transition-all hover:bg-muted/50',
                                    index !== swapFiles.length - 1 && 'border-b'
                                )}
                            >
                                <div className={cn(
                                    'h-10 w-10 rounded-full flex items-center justify-center shrink-0',
                                    isPersistent ? 'bg-blue-50 dark:bg-blue-950' : 'bg-muted'
                                )}>
                                    <HardDrive className={cn(
                                        'h-5 w-5',
                                        isPersistent ? 'text-blue-500' : 'text-muted-foreground'
                                    )} />
                                </div>

	                                <div className="flex-1 min-w-0">
	                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
	                                        <span className={cn(
	                                            'text-xs font-medium px-2 py-0.5 rounded',
	                                            isUnknown
	                                                ? 'bg-muted text-muted-foreground'
	                                                : isPersistent
	                                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
	                                                    : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
	                                        )}>
	                                            {isUnknown ? 'other' : isPersistent ? 'persistent' : 'dynamic'}
	                                        </span>
	                                        <span className={cn(
	                                            'text-xs font-medium px-2 py-0.5 rounded',
	                                            file.active
                                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                        )}>
                                            {file.active ? 'active' : 'inactive'}
                                        </span>
                                        {size && (
                                            <span className="text-sm text-muted-foreground">{size}</span>
                                        )}
	                                    </div>
	                                    <p className="text-sm text-muted-foreground">
	                                        {isUnknown
	                                            ? 'Swap entry detected from /proc/swaps (may be a partition or non-managed swap file).'
	                                            : isPersistent
	                                                ? 'Persistent swap — survives reboots.'
	                                                : file.active
	                                                    ? 'Dynamic swap — currently in use by a running command.'
	                                                    : 'Dynamic swap — command finished, safe to delete.'
	                                        }
	                                    </p>
	                                </div>

	                                {canDelete && (
	                                    <button
	                                        disabled={isDeleting}
	                                        onClick={() => handleDelete(file.path)}
	                                        className="shrink-0 h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
	                                        title="Delete"
	                                    >
	                                        {isDeleting
	                                            ? <Loader2 className="h-4 w-4 animate-spin" />
	                                            : <Trash2 className="h-4 w-4" />
	                                        }
	                                    </button>
	                                )}
	                            </div>
	                        );
	                    })
	                )}
            </div>
        </div>
    );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function SwapperClient({
    serverId,
    initialSwapSize,
    initialMoreDetails,
    initialRecurringSwapMb,
    initialSwapFiles,
}: Props) {
    return (
        <div className="space-y-8">
            <DynamicSwapCard
                serverId={serverId}
                initialSwapSize={initialSwapSize}
                initialMoreDetails={initialMoreDetails}
            />
            <PersistentSwapCard
                serverId={serverId}
                initialRecurringSwapMb={initialRecurringSwapMb}
            />
            <SwapFilesCard
                serverId={serverId}
                initialSwapFiles={initialSwapFiles}
            />
        </div>
    );
}
