
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    Card,
    CardContent,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
    Loader2,
    Trash2,
    Play,
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogClose,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { getServers } from '@/app/servers/actions';
import { getSavedCommands, deleteSavedCommand, executeSavedCommand } from '../actions';
import { SavedCommand } from '../types';
import { useToast } from '@/hooks/use-toast';
import { PageTitleBack } from '@/components/page-header';

export default function CommandDetailPage({ params }: { params: { id: string } }) {
    const { id } = params;
    const router = useRouter();
    const { toast } = useToast();

    // State
    const [command, setCommand] = useState<SavedCommand | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);

    // Run State
    const [servers, setServers] = useState<{ id: string, name: string, type: string }[]>([]);
    const [isRunDialogOpen, setIsRunDialogOpen] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [selectedServer, setSelectedServer] = useState<string>('');
    const [runtimeVariableValues, setRuntimeVariableValues] = useState<Record<string, string>>({});

    // Fetch initial data
    useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                const [allCommandsData, serversData] = await Promise.all([
                    getSavedCommands(),
                    getServers()
                ]);

                const foundCommand = (allCommandsData as SavedCommand[]).find(c => c.id === id);
                if (foundCommand) {
                    setCommand(foundCommand);
                }
                setServers(serversData as { id: string, name: string, type: string }[]);

                const getCookie = (name: string) => {
                    const value = `; ${document.cookie}`;
                    const parts = value.split(`; ${name}=`);
                    if (parts.length === 2) return parts.pop()?.split(';').shift();
                };
                const serverIdCookie = getCookie('selected_server');
                if (serverIdCookie) {
                    setSelectedServer(serverIdCookie);
                }

            } catch (error) {
                toast({ variant: 'destructive', title: 'Error', description: 'Failed to load command details.' });
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, [id, toast]);

    // Handle Delete
    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this command? This action cannot be undone.')) return;

        setIsDeleting(true);
        try {
            await deleteSavedCommand(id);
            toast({ title: 'Command Deleted', description: 'The command has been permanently deleted.' });
            router.push('/server/commands');
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete command.' });
            setIsDeleting(false);
        }
    };

    // Handle Open Run Dialog
    const openRunDialog = () => {
        if (!command) return;
        setRuntimeVariableValues({});

        if (command.variables && command.variables.length > 0) {
            setIsRunDialogOpen(true);
        } else if (!selectedServer) {
            setIsRunDialogOpen(true);
        } else {
            handleRunCommandDirect();
        }
    };

    const handleRunCommandDirect = async () => {
        if (!command) return;
        setIsRunning(true);
        try {
            await executeSavedCommand(selectedServer, command.id, {});
            toast({ title: 'Execution Started', description: `Running "${command.name}" on the selected server. Check history for output.` });
            if (isRunDialogOpen) setIsRunDialogOpen(false);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Execution Failed', description: e.message });
        } finally {
            setIsRunning(false);
        }
    }

    // Handle Run from Dialog
    const handleRunFromDialog = async () => {
        if (!command || !selectedServer) return;
        setIsRunning(true);
        try {
            await executeSavedCommand(selectedServer, command.id, runtimeVariableValues);
            toast({ title: 'Execution Started', description: `Running "${command.name}" on the selected server. Check history for output.` });
            setIsRunDialogOpen(false);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Execution Failed', description: e.message });
        } finally {
            setIsRunning(false);
        }
    }

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-10 w-1/3" />
                <Skeleton className="h-40 w-full" />
            </div>
        );
    }

    if (!command) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center">
                <h2 className="text-xl font-semibold mb-2">Command Not Found</h2>
                <p className="text-muted-foreground mb-4">The command you are looking for does not exist or has been deleted.</p>
                <Button asChild variant="outline">
                    <Link href="/server/commands">Back to Commands</Link>
                </Button>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* 1. Page Title with Back Button */}
            <PageTitleBack
                title={command.name}
                description={command.description || 'No description provided.'}
                backHref="/server/commands"
            />

            {/* 2. Command Block (Card) */}
            <Card className="min-w-0 w-full overflow-hidden bg-card/60">
                <CardContent className="p-0">
                    <div className="font-mono text-sm p-4 whitespace-pre-wrap overflow-x-auto bg-muted/30">
                        {command.command}
                    </div>
                </CardContent>
            </Card>

            {/* Variables (Hidden unless needed, but kept for logic if we decide to show) */}
            {command.variables && command.variables.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {command.variables.map((v, i) => (
                        <div key={i} className="text-sm">
                            <span className="font-mono bg-muted/50 px-1.5 py-0.5 rounded text-foreground font-medium">{v.name}</span>
                            <span className="text-muted-foreground ml-2">- {v.title}</span>
                        </div>
                    ))}
                </div>
            )}


            {/* 3. Run and Delete Buttons */}
            <div className="flex justify-start gap-4 pt-2">
                <Button onClick={openRunDialog} disabled={isRunning} className="min-w-[140px]">
                    {isRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                    Run Command
                </Button>
                <Button variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleDelete} disabled={isDeleting}>
                    {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                    Delete
                </Button>
            </div>

            {/* Run Dialog */}
            <Dialog open={isRunDialogOpen} onOpenChange={setIsRunDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Run Command: {command.name}</DialogTitle>
                        <DialogDescription>Select a server and provide values for any variables.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-6 py-4">
                        {command.variables && command.variables.length > 0 && (
                            <div className="space-y-4">
                                {command.variables.map(variable => (
                                    <div key={variable.name} className="grid gap-2">
                                        <Label htmlFor={`runtime-var-${variable.name}`}>{variable.title}</Label>
                                        {variable.description && <p className="text-xs text-muted-foreground">{variable.description}</p>}
                                        <Input
                                            id={`runtime-var-${variable.name}`}
                                            value={runtimeVariableValues[variable.name] || ''}
                                            onChange={e => setRuntimeVariableValues(prev => ({ ...prev, [variable.name]: e.target.value }))}
                                            placeholder={variable.hint}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="grid gap-2">
                            <Label htmlFor="server-select">Server</Label>
                            <Select onValueChange={setSelectedServer} value={selectedServer}>
                                <SelectTrigger id="server-select">
                                    <SelectValue placeholder="Select a server" />
                                </SelectTrigger>
                                <SelectContent>
                                    {servers.map((server) => (
                                        <SelectItem key={server.id} value={server.id}>
                                            <div className="flex items-center gap-2">
                                                {/* We don't have Server icon import here, just text */}
                                                {server.name} ({server.type})
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                        <Button onClick={handleRunFromDialog} disabled={!selectedServer || isRunning}>
                            {isRunning ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Executing...</> : 'Run on Server'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
