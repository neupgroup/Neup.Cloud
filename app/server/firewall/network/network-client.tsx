'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    Card,
} from "@/components/ui/card";
import { ShieldCheck, Network, Trash2, Plus, Info, Activity, ChevronRight } from "lucide-react";
import { getFirewallStatus, allowPort, deleteRule, toggleFirewall, type FirewallRule } from '../actions';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from "@/components/ui/button";
import { cn } from '@/lib/utils';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';

function RulesList({ rules, onDelete }: { rules: FirewallRule[], onDelete: (id: number) => void }) {
    if (rules.length === 0) {
        return (
            <div className="text-center p-12 border rounded-lg border-dashed text-muted-foreground">
                <p>No firewall rules found. All incoming traffic might be blocked or allowed depending on default policy.</p>
            </div>
        );
    }

    return (
        <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm">
            {rules.map((rule, index) => {
                const isPending = rule.id < 0;
                return (
                    <div key={`${rule.id}-${index}`} className={cn(
                        "p-4 min-w-0 w-full transition-colors hover:bg-muted/50 flex items-center justify-between gap-4",
                        index !== rules.length - 1 && "border-b border-border"
                    )}>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-3 mb-1">
                                <span className="font-mono text-sm font-medium bg-primary/10 text-primary px-2 py-0.5 rounded">
                                    {rule.to}
                                </span>
                                <Badge variant={rule.action.includes('ALLOW') ? 'default' : (rule.action.includes('PENDING') ? 'outline' : 'destructive')} className="text-[10px] h-5">
                                    {rule.action}
                                </Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground mt-2">
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <Network className="h-3.5 w-3.5" />
                                    <span>From: <span className="font-medium text-foreground">{rule.from}</span></span>
                                </div>
                                {rule.ipv6 && (
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <Info className="h-3.5 w-3.5" />
                                        <span>IPv6</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-1.5 shrink-0">
                                    {isPending ? (
                                        <span className="text-muted-foreground italic">Pending Activation</span>
                                    ) : (
                                        <span className="text-muted-foreground">Rule #{rule.id}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => onDelete(rule.id)}
                            disabled={isPending}
                            title={isPending ? "Cannot delete pending rule. Enable firewall first." : "Delete rule"}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                )
            })}
        </Card>
    )
}

function LoadingSkeleton() {
    return (
        <div className="space-y-6">
            <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className={cn(
                        "p-4 min-w-0 w-full flex items-center gap-4",
                        i !== 4 && "border-b border-border"
                    )}>
                        <div className="space-y-3 flex-1">
                            <div className="flex gap-2">
                                <Skeleton className="h-5 w-20" />
                                <Skeleton className="h-5 w-16" />
                            </div>
                            <div className="flex gap-6">
                                <Skeleton className="h-3 w-32" />
                            </div>
                        </div>
                        <Skeleton className="h-8 w-8 rounded-md" />
                    </div>
                ))}
            </Card>
        </div>
    )
}

function AddRuleDialog({ onAdd, isOpen, setIsOpen }: { onAdd: (port: string, protocol: 'tcp' | 'udp') => Promise<void>, isOpen: boolean, setIsOpen: (open: boolean) => void }) {
    const [port, setPort] = useState('');
    const [protocol, setProtocol] = useState<'tcp' | 'udp'>('tcp');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!port) return;
        setIsSubmitting(true);
        await onAdd(port, protocol);
        setIsSubmitting(false);
        setPort('');
        setIsOpen(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Open Port
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Allow Incoming Connection</DialogTitle>
                    <DialogDescription>
                        Open a port to allow traffic from the outside world.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="port" className="text-right">
                            Port
                        </Label>
                        <Input
                            id="port"
                            value={port}
                            onChange={(e) => setPort(e.target.value)}
                            placeholder="e.g. 8080"
                            className="col-span-3"
                            autoFocus
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="protocol" className="text-right">
                            Protocol
                        </Label>
                        <Select value={protocol} onValueChange={(v: 'tcp' | 'udp') => setProtocol(v)}>
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select protocol" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="tcp">TCP</SelectItem>
                                <SelectItem value="udp">UDP</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Adding...' : 'Add Rule'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export default function NetworkClient({ serverId }: { serverId: string }) {
    const { toast } = useToast();
    const router = useRouter();
    const [rules, setRules] = useState<FirewallRule[]>([]);
    const [isActive, setIsActive] = useState(false);
    const [defaults, setDefaults] = useState<{ incoming: string, outgoing: string }>({ incoming: 'unknown', outgoing: 'unknown' });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isToggling, setIsToggling] = useState(false);

    const fetchRules = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await getFirewallStatus(serverId);
            if (result.error) {
                setError(result.error);
                toast({ variant: 'destructive', title: 'Failed to get firewall status', description: result.error });
            } else {
                setRules(result.rules);
                setIsActive(result.active);
                setDefaults({ incoming: result.defaultIncoming, outgoing: result.defaultOutgoing });

                // If inactive and rules exist (pending), show info toast once or just rely on UI
                if (!result.active && result.rules.length > 0) {
                    // checks done in status action
                }
            }
        } catch (e: any) {
            setError(e.message);
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchRules();
    }, [serverId]);

    const handleAddRule = async (port: string, protocol: 'tcp' | 'udp') => {
        try {
            const result = await allowPort(serverId, port, protocol);
            if (result.success) {
                toast({ title: 'Success', description: result.message });
                fetchRules(); // Refresh list
            } else {
                toast({ variant: 'destructive', title: 'Failed', description: result.message });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        }
    };

    const handleDeleteRule = async (id: number) => {
        try {
            const result = await deleteRule(serverId, id);
            if (result.success) {
                toast({ title: 'Success', description: result.message });
                fetchRules(); // Refresh list
            } else {
                toast({ variant: 'destructive', title: 'Failed', description: result.message });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        }
    };

    const handleToggleFirewall = async () => {
        setIsToggling(true);
        try {
            const result = await toggleFirewall(serverId, !isActive);
            if (result.success) {
                toast({ title: 'Success', description: result.message });
                fetchRules();
            } else {
                toast({ variant: 'destructive', title: 'Failed', description: result.message });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setIsToggling(false);
        }
    }

    return (
        <div className="space-y-6">

            {isLoading ? (
                <LoadingSkeleton />
            ) : error ? (
                <Card className="p-8 text-center text-destructive">
                    <p>Error loading firewall rules: {error}</p>
                </Card>
            ) : (
                <div className="space-y-6">
                    <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm">
                        {/* Status Toggle Row */}
                        <div
                            onClick={handleToggleFirewall}
                            className={cn(
                                "p-4 min-w-0 w-full transition-colors flex items-center justify-between border-b border-border",
                                !isToggling ? "hover:bg-muted/50 cursor-pointer" : "cursor-default opacity-70"
                            )}
                        >
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <ShieldCheck className={cn("h-4 w-4", isActive ? "text-green-500" : "text-destructive")} />
                                    <p className="text-base font-semibold text-foreground font-mono leading-tight">
                                        Firewall Service
                                    </p>
                                    {isToggling ? (
                                        <Badge variant="outline" className="gap-1 animate-pulse ml-2">
                                            <Skeleton className="h-3 w-3 rounded-full" />
                                            {isActive ? "Disabling..." : "Enabling..."}
                                        </Badge>
                                    ) : isActive ? (
                                        <Badge className="bg-green-500 hover:bg-green-600 gap-1 ml-2">
                                            Active
                                        </Badge>
                                    ) : (
                                        <Badge variant="destructive" className="gap-1 ml-2">
                                            Inactive
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {isActive
                                        ? "Firewall is currently managing network traffic based on your active rules."
                                        : "Firewall is disabled. All incoming traffic is currently permitted based on server defaults."}
                                </p>
                            </div>
                        </div>

                        {/* Add Rule Row (Only when active) */}
                        {isActive && (
                            <div
                                onClick={() => setIsAddDialogOpen(true)}
                                className="p-4 min-w-0 w-full transition-colors hover:bg-muted/50 cursor-pointer flex items-center justify-between border-b border-border"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Plus className="h-4 w-4 text-primary" />
                                        <p className="text-base font-semibold text-foreground font-mono leading-tight">
                                            Add New Rule
                                        </p>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Open a specific port to allow incoming traffic for your applications.
                                    </p>
                                </div>
                                <AddRuleDialog onAdd={handleAddRule} isOpen={isAddDialogOpen} setIsOpen={setIsAddDialogOpen} />
                            </div>
                        )}

                        {/* Test Connectivity Row */}
                        <div
                            onClick={() => router.push('/server/firewall/network/test')}
                            className="p-4 min-w-0 w-full transition-colors hover:bg-muted/50 cursor-pointer flex items-center justify-between group"
                        >
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <Activity className="h-4 w-4 text-blue-500" />
                                    <p className="text-base font-semibold text-foreground font-mono leading-tight">
                                        Test Network Connectivity
                                    </p>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Verify if the server is receiving requests on specific ports from the internet.
                                </p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                        </div>
                    </Card>


                    {!isActive && rules.length > 0 && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/50 p-4 rounded-md text-sm text-yellow-800 dark:text-yellow-200">
                            <strong>Note:</strong> Some rules are shown as "Pending". These rules have been added but will not be enforced until you enable the firewall.
                        </div>
                    )}

                    <h3 className="text-sm font-medium text-muted-foreground mt-8 mb-2">Active Rules</h3>
                    <RulesList rules={rules} onDelete={handleDeleteRule} />
                </div>
            )}
        </div>
    );
}
