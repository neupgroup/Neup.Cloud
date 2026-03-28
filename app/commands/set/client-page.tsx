'use client';

import { useState, useEffect, Suspense } from 'react';
import {
    Play,
    Trash2,
    Command as CommandIcon,
    Server,
    Loader2,
    ChevronRight,
    Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useToast } from '../../../hooks/use-toast';
import { CommandSet, getCommandSets, deleteCommandSet } from './actions';
import { executeCommand } from '@/app/commands/actions';
import { getServers } from '@/app/servers/actions';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

const COMMANDS_PER_PAGE_FIRST = 8;
const COMMANDS_PER_PAGE_SUBSEQUENT = 10;

function LoadingSkeleton() {
    return (
        <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm">
            {[...Array(9)].map((_, i) => (
                <div key={i} className={cn(
                    "p-4 min-w-0 w-full",
                    i !== 8 && "border-b border-border"
                )}>
                    <div className="space-y-3">
                        <Skeleton className="h-6 w-1/3" />
                        <Skeleton className="h-4 w-1/2" />
                    </div>
                </div>
            ))}
        </Card>
    )
}

function CommandSetsContent() {
    const { toast } = useToast();
    const router = useRouter();
    const [userId] = useState('tempaccount');
    const [commandSets, setCommandSets] = useState<CommandSet[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [isRunOpen, setIsRunOpen] = useState(false);
    const [selectedSet, setSelectedSet] = useState<CommandSet | null>(null);

    const [servers, setServers] = useState<any[]>([]);
    const [selectedServerId, setSelectedServerId] = useState<string>('');
    const [isRunning, setIsRunning] = useState(false);
    const [runProgress, setRunProgress] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        fetchCommandSets(userId);
    }, [userId]);

    const fetchCommandSets = async (uid: string) => {
        setIsLoading(true);
        const sets = await getCommandSets(uid);
        // Sort by creation time if possible, or just as is
        setCommandSets(sets);
        setIsLoading(false);
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this command set?")) return;
        const result = await deleteCommandSet(id);
        if (result.success) {
            toast({ title: "Deleted", description: "Command set removed." });
            fetchCommandSets(userId);
        } else {
            toast({ variant: "destructive", title: "Error", description: result.error });
        }
    };

    const openRunDialog = async (e: React.MouseEvent, set: CommandSet) => {
        e.stopPropagation();
        setSelectedSet(set);
        setIsRunOpen(true);
        setRunProgress('');
        if (servers.length === 0) {
            const serverData = await getServers();
            setServers(serverData || []);
        }
    };

    const handleRun = async () => {
        if (!selectedSet || !selectedServerId) return;
        setIsRunning(true);
        setRunProgress('Initializing...');

        try {
            for (let i = 0; i < selectedSet.commands.length; i++) {
                const cmd = selectedSet.commands[i];
                setRunProgress(`Running command ${i + 1}/${selectedSet.commands.length}: ${cmd.description || '...'}`);

                const result = await executeCommand(
                    selectedServerId,
                    cmd.command,
                    `${selectedSet.name} - ${cmd.description || 'Command ' + (i + 1)}`,
                    cmd.command
                );

                if (result.error) {
                    throw new Error(result.error);
                }
            }
            toast({ title: "Completed", description: "All commands executed successfully." });
            setRunProgress('Completed successfully.');
            setTimeout(() => setIsRunOpen(false), 1500);
        } catch (e: any) {
            setRunProgress(`Error: ${e.message}`);
            toast({ variant: "destructive", title: "Execution Failed", description: e.message });
        } finally {
            setIsRunning(false);
        }
    };

    const handleImportClick = () => {
        toast({ title: "Coming Soon", description: "Import functionality will be available in a future update.", duration: 3000 });
    }

    const filteredSets = commandSets.filter(set =>
        set.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (set.description || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const totalItems = filteredSets.length;
    const totalPages = totalItems <= COMMANDS_PER_PAGE_FIRST
        ? 1
        : 1 + Math.ceil((totalItems - COMMANDS_PER_PAGE_FIRST) / COMMANDS_PER_PAGE_SUBSEQUENT);

    const getPaginatedSets = () => {
        if (currentPage === 1) {
            return filteredSets.slice(0, COMMANDS_PER_PAGE_FIRST);
        }
        const start = COMMANDS_PER_PAGE_FIRST + (currentPage - 2) * COMMANDS_PER_PAGE_SUBSEQUENT;
        const end = start + COMMANDS_PER_PAGE_SUBSEQUENT;
        return filteredSets.slice(start, end);
    };

    const paginatedSets = getPaginatedSets();

    return (
        <div className="grid gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold font-headline tracking-tight">Command Sets</h1>
                    <p className="text-muted-foreground">
                        Create, manage, and run your sequences of commands.
                    </p>
                </div>
            </div>

            <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search command sets..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    autoFocus={!!searchQuery}
                />
            </div>

            {isLoading ? (
                <LoadingSkeleton />
            ) : (
                <>
                    {/* Static Actions: Only on Page 1 and no search query */}
                    {currentPage === 1 && !searchQuery && (
                        <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm">
                            {/* Create Command Set */}
                            <div
                                className={cn(
                                    "p-4 min-w-0 w-full transition-colors hover:bg-muted/50 group flex items-start gap-4 cursor-pointer border-b border-border",
                                )}
                                onClick={() => router.push('/commands/set/create')}
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between mb-0 h-8">
                                        <h3 className="font-semibold leading-none tracking-tight truncate pr-4 text-foreground group-hover:underline decoration-muted-foreground/30 underline-offset-4">
                                            Create Command Set
                                        </h3>


                                        {/* Arrow Icon */}
                                        <div className="flex items-center gap-1">
                                            <div className="h-8 w-8 flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors">
                                                <ChevronRight className="h-4 w-4" />
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-sm text-muted-foreground line-clamp-2">
                                        Build a reusable sequence of multiple commands
                                    </p>
                                </div>
                            </div>

                            {/* Import Command Set */}
                            <div
                                className={cn(
                                    "p-4 min-w-0 w-full transition-colors hover:bg-muted/50 group flex items-start gap-4 cursor-pointer",
                                )}
                                onClick={handleImportClick}
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between mb-0 h-8">
                                        <h3 className="font-semibold leading-none tracking-tight truncate pr-4 text-foreground group-hover:underline decoration-muted-foreground/30 underline-offset-4">
                                            Import Command Set
                                        </h3>

                                        {/* Arrow Icon */}
                                        <div className="flex items-center gap-1">
                                            <div className="h-8 w-8 flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors">
                                                <ChevronRight className="h-4 w-4" />
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-sm text-muted-foreground line-clamp-2">
                                        Import a command set from a file or JSON
                                    </p>
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* Dynamic Command Sets List */}
                    {commandSets.length > 0 && (
                        <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm">
                            {filteredSets.length === 0 && searchQuery ? (
                                <div className="text-center p-12 text-muted-foreground">
                                    <p>No command sets found matching &quot;{searchQuery}&quot;</p>
                                </div>
                            ) : (
                                paginatedSets.map((set, index) => (
                                    <div
                                        key={set.id}
                                        className={cn(
                                            "p-4 min-w-0 w-full transition-colors hover:bg-muted/50 group flex items-start gap-4 cursor-pointer",
                                            // Add border bottom unless it's the very last item of the list
                                            index !== paginatedSets.length - 1 && "border-b border-border"
                                        )}
                                        // Clicking row goes to Edit page
                                        onClick={() => router.push(`/commands/set/${set.id}`)}
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between mb-0">
                                                <h3 className="font-semibold leading-none tracking-tight truncate pr-4 text-foreground group-hover:underline decoration-muted-foreground/30 underline-offset-4">
                                                    {set.name}
                                                </h3>

                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-background/80"
                                                        onClick={(e) => openRunDialog(e, set)}
                                                        disabled={isRunning}
                                                        title="Run Sequence"
                                                    >
                                                        {isRunning && selectedSet?.id === set.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                                                    </Button>
                                                    <div className="h-4 w-px bg-border mx-1" />
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                        onClick={(e) => handleDelete(e, set.id)}
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>

                                            <p className="text-sm text-muted-foreground line-clamp-2">
                                                {set.description || <span className="italic">No description provided</span>}
                                            </p>
                                            <div className="flex items-center gap-2 mt-2">
                                                <div className="text-xs font-mono text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                                                    {set.commands.length} steps
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </Card>
                    )}
                </>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                        >
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                        >
                            Next
                        </Button>
                    </div>
                    <div className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages}
                    </div>
                </div>
            )}

            {/* Run Dialog */}
            <Dialog open={isRunOpen} onOpenChange={setIsRunOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Run Command Set: {selectedSet?.name}</DialogTitle>
                        <DialogDescription>
                            Select a server to execute {selectedSet?.commands.length} commands sequentially.
                        </DialogDescription>
                    </DialogHeader>

                    {!isRunning ? (
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label>Select Server</Label>
                                <Select onValueChange={setSelectedServerId} value={selectedServerId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a server..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {servers.map((s) => (
                                            <SelectItem key={s.id} value={s.id}>
                                                <div className="flex items-center gap-2">
                                                    <Server className="h-4 w-4 text-muted-foreground" />
                                                    {s.name}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="bg-muted p-4 rounded-md text-sm max-h-40 overflow-y-auto space-y-2">
                                <Label className="text-xs text-muted-foreground uppercase">Execution Plan</Label>
                                {selectedSet?.commands.map((c, i) => (
                                    <div key={i} className="flex gap-2">
                                        <span className="text-muted-foreground">{i + 1}.</span>
                                        <span className="font-mono">{c.command}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="py-8 text-center space-y-4">
                            <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
                            <div className="text-lg font-medium">Executing Command Set</div>
                            <p className="text-muted-foreground">{runProgress}</p>
                        </div>
                    )}

                    {!isRunning && (
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsRunOpen(false)}>Cancel</Button>
                            <Button onClick={handleRun} disabled={!selectedServerId}>Run Commands</Button>
                        </DialogFooter>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default function CommandSetsPage() {
    return (
        <Suspense fallback={<LoadingSkeleton />}>
            <CommandSetsContent />
        </Suspense>
    )
}
