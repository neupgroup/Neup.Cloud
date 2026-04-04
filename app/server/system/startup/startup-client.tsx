'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    Card,
} from "@/components/ui/card";
import { Search, Package, Trash2, Plus } from "lucide-react";
import { getStartupServices, toggleService, createService, type StartupService } from './actions';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from '@/lib/utils';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from '@/components/ui/badge';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";

function StartupList({ services, onDisable, onAddClick }: { services: StartupService[], onDisable: (name: string) => void, onAddClick: () => void }) {
    return (
        <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm">
            {/* Add Service Row */}
            <div
                onClick={onAddClick}
                className="p-4 min-w-0 w-full transition-colors hover:bg-muted/50 cursor-pointer flex items-center justify-between border-b border-border"
            >
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <Plus className="h-4 w-4 text-primary" />
                        <p className="text-base font-semibold text-foreground font-mono leading-tight">
                            Add New Service
                        </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Enable an existing system service or create a custom startup program.
                    </p>
                </div>
            </div>

            {services.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                    <p>No enabled startup services found.</p>
                </div>
            ) : (
                services.map((service, index) => (
                    <div key={service.unitFile} className={cn(
                        "p-4 min-w-0 w-full transition-colors hover:bg-muted/50 flex items-center justify-between gap-4",
                        index !== services.length - 1 && "border-b border-border"
                    )}>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-3 mb-1">
                                <span className="font-mono text-sm font-medium">
                                    {service.unitFile}
                                </span>
                                <Badge variant="outline" className="text-[10px] h-5 bg-green-50 text-green-700 border-green-200">
                                    {service.state}
                                </Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground mt-2">
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <Package className="h-3.5 w-3.5" />
                                    <span>Vendor Preset: <span className="font-medium text-foreground">{service.vendorPreset}</span></span>
                                </div>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Are you sure you want to disable ${service.unitFile}? It will no longer start automatically.`)) {
                                    onDisable(service.unitFile);
                                }
                            }}
                            title="Disable (remove from startup)"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                ))
            )}
        </Card>
    )
}

function LoadingSkeleton() {
    return (
        <div className="space-y-6">
            <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm">
                <div className="p-4 min-w-0 w-full border-b border-border">
                    <div className="space-y-2">
                        <Skeleton className="h-5 w-40" />
                        <Skeleton className="h-4 w-60" />
                    </div>
                </div>
                {[...Array(5)].map((_, i) => (
                    <div key={i} className={cn(
                        "p-4 min-w-0 w-full flex items-center gap-4",
                        i !== 4 && "border-b border-border"
                    )}>
                        <div className="space-y-3 flex-1">
                            <div className="flex gap-2">
                                <Skeleton className="h-5 w-48" />
                                <Skeleton className="h-5 w-16" />
                            </div>
                            <Skeleton className="h-3 w-32" />
                        </div>
                        <Skeleton className="h-8 w-8 rounded-md" />
                    </div>
                ))}
            </Card>
        </div>
    )
}

function AddServiceDialog({ onAdd, isOpen, setIsOpen }: {
    onAdd: (data: any) => Promise<void>,
    isOpen: boolean,
    setIsOpen: (open: boolean) => void
}) {
    const [mode, setMode] = useState<'existing' | 'custom'>('existing');
    const [name, setName] = useState('');

    // Custom fields
    const [description, setDescription] = useState('');
    const [command, setCommand] = useState('');
    const [user, setUser] = useState('root');
    const [directory, setDirectory] = useState('/root');

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name) return;

        setIsSubmitting(true);
        if (mode === 'existing') {
            await onAdd({ name, mode: 'existing' });
        } else {
            await onAdd({ name, mode: 'custom', description, command, user, directory });
        }
        setIsSubmitting(false);
        setIsOpen(false);
        // Reset form
        setName('');
        setCommand('');
        setDescription('');
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Add Startup Service</DialogTitle>
                    <DialogDescription>
                        Enable an existing service or create a new one.
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="existing">Existing Service</TabsTrigger>
                        <TabsTrigger value="custom">Custom Program</TabsTrigger>
                    </TabsList>

                    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                        <TabsContent value="existing" className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name">Service Name</Label>
                                <Input
                                    id="name"
                                    placeholder="e.g. nginx, mysql"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required={mode === 'existing'}
                                />
                                <p className="text-xs text-muted-foreground">The name of the systemd service to enable.</p>
                            </div>
                        </TabsContent>

                        <TabsContent value="custom" className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="custom-name">Service Name</Label>
                                <Input
                                    id="custom-name"
                                    placeholder="e.g. my-app"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required={mode === 'custom'}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="command">Command to Run</Label>
                                <Input
                                    id="command"
                                    placeholder="e.g. /usr/bin/python3 /root/app.py"
                                    value={command}
                                    onChange={(e) => setCommand(e.target.value)}
                                    required={mode === 'custom'}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="user">User</Label>
                                    <Input
                                        id="user"
                                        value={user}
                                        onChange={(e) => setUser(e.target.value)}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="dir">Working Directory</Label>
                                    <Input
                                        id="dir"
                                        value={directory}
                                        onChange={(e) => setDirectory(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="desc">Description (Optional)</Label>
                                <Input
                                    id="desc"
                                    placeholder="My custom application"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                />
                            </div>
                        </TabsContent>

                        <DialogFooter>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Processing...' : (mode === 'existing' ? 'Enable Service' : 'Create & Enable')}
                            </Button>
                        </DialogFooter>
                    </form>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}

export default function StartupClient({ serverId }: { serverId: string }) {
    const { toast } = useToast();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [services, setServices] = useState<StartupService[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState(searchParams.get('query') || '');
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

    const fetchServices = async () => {
        try {
            const result = await getStartupServices(serverId);
            if (result.error) {
                setError(result.error);
                toast({ variant: 'destructive', title: 'Failed to get startup services', description: result.error });
            } else if (result.services) {
                setServices(result.services);
            }
        } catch (e: any) {
            setError(e.message);
            toast({ variant: 'destructive', title: 'An unexpected error occurred', description: e.message });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        setIsLoading(true);
        setError(null);
        fetchServices();
    }, [serverId, toast]);

    useEffect(() => {
        const query = searchParams.get('query');
        if (query !== null && query !== searchQuery) {
            setSearchQuery(query);
        }
    }, [searchParams]);

    const handleSearchChange = (val: string) => {
        setSearchQuery(val);
        const params = new URLSearchParams(searchParams.toString());
        if (val) {
            params.set('query', val);
        } else {
            params.delete('query');
        }
        router.replace(`?${params.toString()}`, { scroll: false });
    };

    const handleAdd = async (data: any) => {
        try {
            let result;
            if (data.mode === 'existing') {
                result = await toggleService(serverId, data.name, true);
            } else {
                result = await createService(serverId, {
                    name: data.name,
                    command: data.command,
                    description: data.description,
                    user: data.user,
                    directory: data.directory
                });
            }

            if (result.success) {
                toast({ title: 'Success', description: `Service ${data.name} enabled successfully.` });
                fetchServices();
            } else {
                toast({ variant: 'destructive', title: 'Failed', description: result.error });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        }
    };

    const handleDisable = async (name: string) => {
        try {
            const result = await toggleService(serverId, name, false);
            if (result.success) {
                toast({ title: 'Success', description: `Service ${name} disabled.` });
                fetchServices();
            } else {
                toast({ variant: 'destructive', title: 'Failed', description: result.error });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        }
    };

    const filteredServices = services.filter(s =>
        s.unitFile.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search services..."
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="pl-9"
                    />
                </div>
            </div>

            {isLoading ? (
                <LoadingSkeleton />
            ) : error ? (
                <Card className="p-8 text-center text-destructive">
                    <p>Error loading startup services: {error}</p>
                </Card>
            ) : (
                <StartupList
                    services={filteredServices}
                    onDisable={handleDisable}
                    onAddClick={() => setIsAddDialogOpen(true)}
                />
            )}

            <AddServiceDialog
                isOpen={isAddDialogOpen}
                setIsOpen={setIsAddDialogOpen}
                onAdd={handleAdd}
            />
        </div>
    );
}
