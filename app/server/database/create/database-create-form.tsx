'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Database, ShieldCheck, Key, User, AlertTriangle, CheckCircle, ArrowRight, Server } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { type DatabaseInstallation, installDatabaseEngine, checkDatabaseInstallation, createDatabaseInstance } from '@/actions/database';

interface DatabaseCreateFormProps {
    serverId?: string;
    initialInstallation: DatabaseInstallation | null;
}

export function DatabaseCreateForm({ serverId, initialInstallation }: DatabaseCreateFormProps) {
    const router = useRouter();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [isInstalling, setIsInstalling] = useState(false);
    const [installation, setInstallation] = useState<DatabaseInstallation | null>(initialInstallation);

    // Form state
    const [engine, setEngine] = useState('mariadb');
    const [dbName, setDbName] = useState('');
    const [dbUser, setDbUser] = useState('');
    const [dbPassword, setDbPassword] = useState('');

    const isEngineInstalled = installation?.details?.[engine]?.status === 'installed';

    const handleInstall = async () => {
        if (!serverId) return;
        setIsInstalling(true);
        try {
            const result = await installDatabaseEngine(serverId, engine as 'mariadb' | 'postgres');
            if (result.success) {
                toast({
                    title: 'Installation Successful',
                    description: result.message,
                });
                // Refresh installation status
                const newStatus = await checkDatabaseInstallation(serverId);
                setInstallation(newStatus);
            } else {
                toast({
                    variant: 'destructive',
                    title: 'Installation Failed',
                    description: result.message,
                });
            }
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.message || 'Failed to install database engine.',
            });
        } finally {
            setIsInstalling(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!serverId) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Please select a server first.',
            });
            return;
        }

        if (!isEngineInstalled) {
            toast({
                variant: 'destructive',
                title: 'Engine Not Installed',
                description: `Please install ${engine} before creating a database.`,
            });
            return;
        }

        setIsLoading(true);

        try {
            const result = await createDatabaseInstance(
                serverId,
                engine as 'mariadb' | 'postgres',
                dbName,
                dbUser,
                dbPassword
            );

            if (result.success) {
                toast({
                    title: 'Database created',
                    description: result.message,
                });
                router.push('/server/database');
            } else {
                toast({
                    variant: 'destructive',
                    title: 'Creation Failed',
                    description: result.message,
                });
            }
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.message || 'Failed to create database.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 pb-20">
            <Card className="overflow-hidden border-2 border-primary/5">
                <CardHeader className="bg-muted/30">
                    <CardTitle className="flex items-center gap-2">
                        <Database className="h-5 w-5 text-primary" />
                        Database Engine
                    </CardTitle>
                    <CardDescription>Select the type of database you want to create</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    <RadioGroup
                        value={engine}
                        onValueChange={setEngine}
                        className="grid grid-cols-1 md:grid-cols-2 gap-4"
                    >
                        <div>
                            <RadioGroupItem value="mariadb" id="mariadb" className="peer sr-only" />
                            <Label
                                htmlFor="mariadb"
                                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary transition-all cursor-pointer"
                            >
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-blue-500/10 rounded-full">
                                        <span className="font-bold text-blue-500">My</span>
                                    </div>
                                    <span className="font-semibold text-lg">MariaDB</span>
                                </div>
                                <p className="text-xs text-center text-muted-foreground">
                                    Reliable, performant and popular relational database engine.
                                </p>
                            </Label>
                        </div>
                        <div>
                            <RadioGroupItem value="postgres" id="postgres" className="peer sr-only" />
                            <Label
                                htmlFor="postgres"
                                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary transition-all cursor-pointer"
                            >
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-indigo-500/10 rounded-full">
                                        <span className="font-bold text-indigo-500">Pg</span>
                                    </div>
                                    <span className="font-semibold text-lg">PostgreSQL</span>
                                </div>
                                <p className="text-xs text-center text-muted-foreground">
                                    Advanced open source relational database with focus on extensibility.
                                </p>
                            </Label>
                        </div>
                    </RadioGroup>
                </CardContent>
            </Card>

            {/* Installation Panel */}
            {!isEngineInstalled ? (
                <Card className="border-2 border-primary/20 bg-primary/5 overflow-hidden animate-in zoom-in-95 duration-300">
                    <CardContent className="pt-6">
                        <div className="flex flex-col md:flex-row items-center gap-6">
                            <div className="p-4 bg-primary/10 rounded-full">
                                <AlertTriangle className="h-8 w-8 text-primary" />
                            </div>
                            <div className="flex-1 text-center md:text-left">
                                <h3 className="text-xl font-bold tracking-tight">Engine Not Found</h3>
                                <p className="text-muted-foreground mb-6">
                                    {engine.toUpperCase()} is required but not detected on this server. Install it now to proceed with database creation.
                                </p>
                                <div className="flex flex-wrap justify-center md:justify-start gap-4">
                                    <Button
                                        type="button"
                                        onClick={handleInstall}
                                        disabled={isInstalling}
                                        className="bg-primary hover:bg-primary/90 text-primary-foreground h-11 px-6 shadow-xl shadow-primary/20"
                                    >
                                        {isInstalling ? (
                                            <>
                                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                Installing {engine.toUpperCase()}...
                                            </>
                                        ) : (
                                            <>
                                                <Server className="mr-2 h-5 w-5" />
                                                Install {engine.toUpperCase()} Engine
                                            </>
                                        )}
                                    </Button>
                                    <Button variant="outline" type="button" className="h-11 px-6 border-primary/20 hover:bg-primary/5 hover:text-primary transition-colors">
                                        View Documentation
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="flex items-center gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="p-1.5 bg-primary/10 rounded-full">
                        <CheckCircle className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 flex items-center justify-between">
                        <span className="text-sm font-medium text-primary uppercase">
                            {engine} engine is ready
                        </span>
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                            VERIFIED
                        </Badge>
                    </div>
                </div>
            )}

            <Card className={!isEngineInstalled ? "opacity-50 pointer-events-none grayscale transition-all" : "border-2 border-primary/5 transition-all"}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-primary" />
                        Database Configuration
                    </CardTitle>
                    <CardDescription>Enter the connection details for your new database</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="dbName">Database Name</Label>
                        <div className="relative">
                            <Database className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="dbName"
                                value={dbName}
                                onChange={(e) => setDbName(e.target.value)}
                                placeholder="my_database"
                                className="pl-10"
                                required={isEngineInstalled}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        <div className="space-y-2">
                            <Label htmlFor="dbUser">Username</Label>
                            <div className="relative">
                                <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="dbUser"
                                    value={dbUser}
                                    onChange={(e) => setDbUser(e.target.value)}
                                    placeholder="db_user"
                                    className="pl-10"
                                    required={isEngineInstalled}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="dbPassword">Password</Label>
                            <div className="relative">
                                <Key className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="dbPassword"
                                    type="password"
                                    value={dbPassword}
                                    onChange={(e) => setDbPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="pl-10"
                                    required={isEngineInstalled}
                                />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className={!isEngineInstalled ? "opacity-50 grayscale flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/10" : "flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/10"}>
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-full">
                        <ShieldCheck className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <p className="font-medium text-sm">Security Note</p>
                        <p className="text-xs text-muted-foreground">This will create a new database and a user with full privileges to it.</p>
                    </div>
                </div>
                <Badge variant="outline" className="text-primary border-primary/20">Automatic ACL</Badge>
            </div>

            <div className="flex gap-4 pt-4">
                <Button type="submit" className="px-8 shadow-lg shadow-primary/20" disabled={isLoading || !serverId || !isEngineInstalled}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Database
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    onClick={() => router.push('/server/database')}
                    disabled={isLoading}
                >
                    Cancel
                </Button>
            </div>
        </form>
    );
}
