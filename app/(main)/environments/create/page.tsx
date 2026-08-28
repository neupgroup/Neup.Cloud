'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageTitleBack } from '@/components/page-header';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/component/ui/card';
import { Button } from '@/component/ui/button';
import { Input } from '@/component/ui/input';
import { Label } from '@/component/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/component/ui/select';
import { useToast } from '@/core/hooks/useToast';
import { Loader2, Save, Check } from 'lucide-react';
import { cn } from '@/core/utils';
import { Badge } from '@/component/ui/badge';
import { Switch } from '@/component/ui/switch';
import { createEnvironmentVariable } from '@/services/environment-variables/environment-variables-service';

const AVAILABLE_SERVERS = [
    { id: 's1', name: 'web-server-01' },
    { id: 's2', name: 'db-server-01' },
    { id: 's3', name: 'worker-node-01' },
];

const AVAILABLE_APPS = [
    { id: 'a1', name: 'neup-web' },
    { id: 'a2', name: 'neup-api' },
];

export default function CreateEnvironmentPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    // Form State
    const [key, setKey] = useState('');
    const [value, setValue] = useState('');
    const [targetType, setTargetType] = useState<'account' | 'server' | 'app'>('account');
    const [selectedTargets, setSelectedTargets] = useState<string[]>([]);

    // Security Options
    const [isConfidential, setIsConfidential] = useState(false);
    const [protectValue, setProtectValue] = useState(false);

    const handleTargetTypeChange = (type: string) => {
        setTargetType(type as any);
        setSelectedTargets([]); // Clear specific selections when switching types
    };

    const toggleTarget = (id: string) => {
        setSelectedTargets(prev =>
            prev.includes(id)
                ? prev.filter(t => t !== id)
                : [...prev, id]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Process Key Logic
        let processedKey = key;
        // 1. Remove non-alphanumeric characters from start and end
        processedKey = processedKey.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
        // 2. Replace remaining non-alphanumeric characters with _
        processedKey = processedKey.replace(/[^a-zA-Z0-9]/g, '_');
        // 3. Remove leading numbers
        processedKey = processedKey.replace(/^[0-9]+/, '');
        // 4. Uppercase
        processedKey = processedKey.toUpperCase();

        if (!processedKey || !value.trim()) {
            toast({
                title: "Validation Error",
                description: !processedKey ? "Key is invalid or empty after formatting." : "Value is required.",
                variant: "destructive"
            });
            return;
        }

        if (targetType !== 'account' && selectedTargets.length === 0) {
            toast({
                title: "Validation Error",
                description: `Please select at least one ${targetType}.`,
                variant: "destructive"
            });
            return;
        }

        setIsLoading(true);

        const result = await createEnvironmentVariable({
            key: processedKey,
            value,
            targetType,
            selectedTargets,
            isConfidential,
            protectValue
        });

        if (result.error) {
            toast({
                title: "Error",
                description: result.error,
                variant: "destructive"
            });
            setIsLoading(false);
            return;
        }

        toast({
            title: "Variable Created",
            description: `${processedKey} has been added successfully.`,
        });

        setIsLoading(false);
        router.push('/environments');
    };

    return (
        <div className="grid gap-6 animate-in fade-in duration-500 pb-10">
            <PageTitleBack
                title="Create Environment Variable"
                description="Add a new global or specific environment variable."
                backHref="/environments"
            />

            <form onSubmit={handleSubmit} className="max-w-2xl mx-auto w-full">
                <Card>
                    <CardHeader>
                        <CardTitle>Variable Details</CardTitle>
                        <CardDescription>
                            Configure the key, value, and applicability of your variable.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-6">

                        <div className="grid gap-2">
                            <Label htmlFor="key" className="text-base font-semibold">Key</Label>
                            <Input
                                id="key"
                                placeholder="e.g. DATABASE_URL"
                                value={key}
                                onChange={(e) => setKey(e.target.value)}
                                className="font-mono"
                            />
                            <p className="text-xs text-muted-foreground">
                                Key will be automatically formatted and validated on save (e.g., 'my-var!' -&gt; 'MY_VAR').
                            </p>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="value" className="text-base font-semibold">Value</Label>
                            <Input
                                id="value"
                                placeholder="Paste your secret value here"
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                            />
                        </div>

                        {/* Security Options */}
                        <div className="grid gap-4">
                            <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Confidential</Label>
                                    <CardDescription>
                                        Hide this value in logs and runtime displays.
                                    </CardDescription>
                                </div>
                                <Switch
                                    checked={isConfidential}
                                    onCheckedChange={setIsConfidential}
                                />
                            </div>

                            <div className="flex flex-row items-center justify-between rounded-lg border p-4 bg-muted/20">
                                <div className="space-y-0.5 mr-4">
                                    <Label className="text-base">Protect Value</Label>
                                    <CardDescription>
                                        Encrypted storage; strictly private and unrecoverable if the key is lost.
                                    </CardDescription>
                                </div>
                                <Switch
                                    checked={protectValue}
                                    onCheckedChange={setProtectValue}
                                />
                            </div>
                        </div>

                        <div className="grid gap-4">
                            <Label htmlFor="target-type" className="text-base font-semibold">Applicable For</Label>
                            <Select value={targetType} onValueChange={handleTargetTypeChange}>
                                <SelectTrigger id="target-type">
                                    <SelectValue placeholder="Select applicability" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="account">Account (All)</SelectItem>
                                    <SelectItem value="server">Specific Servers</SelectItem>
                                    <SelectItem value="app">Specific Applications</SelectItem>
                                </SelectContent>
                            </Select>

                            {/* Specific Selection UI */}
                            {targetType !== 'account' && (
                                <div className="grid gap-2 animate-in fade-in slide-in-from-top-2">
                                    <Label className="text-sm text-muted-foreground">
                                        Select {targetType === 'server' ? 'Servers' : 'Applications'}
                                    </Label>
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {(targetType === 'server' ? AVAILABLE_SERVERS : AVAILABLE_APPS).map((item) => {
                                            const isSelected = selectedTargets.includes(item.id);
                                            return (
                                                <Badge
                                                    key={item.id}
                                                    variant={isSelected ? "default" : "outline"}
                                                    className={cn(
                                                        "cursor-pointer px-3 py-1.5 text-sm font-medium transition-all hover:bg-primary/90 hover:text-primary-foreground",
                                                        isSelected ? "bg-primary text-primary-foreground" : "bg-transparent text-foreground"
                                                    )}
                                                    onClick={() => toggleTarget(item.id)}
                                                >
                                                    {item.name}
                                                    {isSelected && <Check className="ml-1.5 h-3.5 w-3.5" />}
                                                </Badge>
                                            );
                                        })}
                                    </div>
                                    {selectedTargets.length === 0 && (
                                        <p className="text-xs text-destructive">
                                            Please select at least one item.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                    </CardContent>
                    <CardFooter className="border-t px-6 py-4 flex justify-end">
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" />
                                    Create Variable
                                </>
                            )}
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </div>
    );
}
