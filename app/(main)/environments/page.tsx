"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageTitle } from '@/components/page-header';
import { Card } from '@/component/ui/card';
import { DeleteButton } from '@/components/delete-button';
import { Input } from '@/component/ui/input';
import { Trash, Search, Globe, Server, Lock, ChevronRight, PlusCircle, ShieldAlert, EyeOff } from 'lucide-react';
import { useToast } from '@/core/hooks/useToast';
import { cn } from '@/core/utils';
import { getEnvironmentVariables, deleteEnvironmentVariable, type EnvironmentVariable } from '@/services/environment-variables/environment-variables-service';
import { Badge } from '@/component/ui/badge';

export default function EnvironmentsPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [variables, setVariables] = useState<EnvironmentVariable[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        async function loadVars() {
            setIsLoading(true);
            const { variables, error } = await getEnvironmentVariables();
            if (variables) {
                setVariables(variables);
            }
            if (error) {
                toast({ title: "Error loading variables", description: error, variant: "destructive" });
            }
            setIsLoading(false);
        }
        loadVars();
    }, [toast]);

    const handleDelete = async (id: string) => {
        const res = await deleteEnvironmentVariable(id);
        if (res.success) {
            setVariables(variables.filter(v => v.id !== id));
            toast({
                title: "Variable Deleted",
                description: "The environment variable has been removed.",
            });
        } else {
            toast({
                title: "Error",
                description: res.error,
                variant: "destructive"
            });
        }
    };

    const getMaskedValue = (value: string, isConfidential: boolean) => {
        if (isConfidential) return 'CONFIDENTIAL';
        if (!value) return '';
        if (value.length <= 3) return '•••';
        return value.substring(0, 3) + '••••••••';
    };

    const filteredVariables = variables.filter(v =>
        v.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.targetType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.selectedTargets.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const getScopeLabel = (type: string) => {
        if (type === 'account') return 'Global';
        if (type === 'server') return 'Servers';
        if (type === 'app') return 'Apps';
        return type;
    };

    return (
        <div className="grid gap-6 animate-in fade-in duration-500 pb-10">
            <PageTitle
                title="Environments"
                description="Manage global environment variables for your applications."
            />

            <div className="space-y-6">

                {/* Search Bar */}
                <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search variables by key, scope, or target..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>

                {/* Create Action Card */}
                {!searchQuery && (
                    <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => router.push('/environments/create')}>
                        <div className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                    <PlusCircle className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-base">Create New Variable</h3>
                                    <p className="text-sm text-muted-foreground">Add a new global or scoped environment variable.</p>
                                </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                    </Card>
                )}

                {/* List Block (Network Style) */}
                <Card className="min-w-0 w-full rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
                    {isLoading ? (
                        <div className="p-8 text-center text-muted-foreground">
                            Loading variables...
                        </div>
                    ) : filteredVariables.length === 0 ? (
                        <div className="text-center p-12 text-muted-foreground">
                            <p>{variables.length === 0 ? "No environment variables created yet." : `No variables found matching "${searchQuery}"`}</p>
                        </div>
                    ) : (
                        filteredVariables.map((variable, index) => (
                            <div
                                key={variable.id}
                                className={cn(
                                    "p-4 min-w-0 w-full transition-colors hover:bg-muted/50 group flex items-start gap-4",
                                    index !== filteredVariables.length - 1 && "border-b border-border"
                                )}
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 mb-3">
                                        <p className="text-sm font-medium text-foreground break-all font-mono leading-tight">
                                            {variable.key}
                                        </p>
                                        {variable.isConfidential && (
                                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-amber-500/50 text-amber-600 bg-amber-500/10 gap-1">
                                                <EyeOff className="h-3 w-3" /> Confidential
                                            </Badge>
                                        )}
                                        {variable.protectValue && (
                                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-red-500/50 text-red-600 bg-red-500/10 gap-1">
                                                <ShieldAlert className="h-3 w-3" /> Protected
                                            </Badge>
                                        )}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <Lock className="h-3.5 w-3.5" />
                                            <span className="font-mono">{getMaskedValue(variable.value, variable.isConfidential)}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <Globe className="h-3.5 w-3.5" />
                                            <span>{getScopeLabel(variable.targetType)}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <Server className="h-3.5 w-3.5" />
                                            <span className="truncate max-w-[200px]">
                                                {variable.targetType === 'account' ? 'All Servers' : variable.selectedTargets.join(', ')}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity self-center">
                                    <DeleteButton
                                        iconOnly
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                        onDelete={() => handleDelete(variable.id)}
                                        confirmTitle="Delete Environment Variable?"
                                        confirmDescription={
                                            <span>
                                                This action cannot be undone. The variable will be <strong>deleted</strong> immediately.<br /><br />
                                                Note: This may affect running applications.
                                            </span>
                                        }
                                        confirmLabel="Delete Variable"
                                    />
                                </div>
                            </div>
                        ))
                    )}
                </Card>
            </div>
        </div>
    );
}
