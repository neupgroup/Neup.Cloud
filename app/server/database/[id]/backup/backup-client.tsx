
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Database, Download, FileJson, FileCode, ShieldCheck, CheckCircle2, Loader2, ChevronLeft, AlertCircle, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from '@/hooks/use-toast';
import { generateDatabaseBackup } from "@/actions/database";
import Link from 'next/link';

interface BackupClientPageProps {
    serverId: string;
    engine: 'mariadb' | 'postgres';
    dbName: string;
}

export function BackupClientPage({ serverId, engine, dbName }: BackupClientPageProps) {
    const { toast } = useToast();
    const [isGenerating, setIsGenerating] = useState<string | null>(null);

    const handleBackup = async (mode: 'full' | 'schema') => {
        setIsGenerating(mode);
        try {
            const result = await generateDatabaseBackup(serverId, engine, dbName, mode);

            if (result.success && result.content) {
                // Create a blob and download it
                const blob = new Blob([result.content], { type: 'text/sql' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = result.filename || `${dbName}_backup.sql`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);

                toast({
                    title: 'Download Started',
                    description: `Your ${mode} backup is being saved to your computer.`,
                });
            } else {
                toast({
                    variant: 'destructive',
                    title: 'Backup Failed',
                    description: result.message,
                });
            }
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.message || 'Failed to generate backup.',
            });
        } finally {
            setIsGenerating(null);
        }
    };

    return (
        <div className="grid gap-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <Button variant="ghost" className="pl-0 hover:bg-transparent text-muted-foreground hover:text-foreground" asChild>
                        <Link href={`/server/database/${engine}-${dbName}`}>
                            <ChevronLeft className="h-4 w-4 mr-1" /> Back to Database
                        </Link>
                    </Button>
                    <h1 className="text-3xl font-bold tracking-tight">Export & Backups</h1>
                    <p className="text-muted-foreground">Download database dumps for <span className="text-foreground font-medium">{dbName}</span></p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-2 border-primary/5 hover:border-primary/10 transition-all overflow-hidden">
                    <CardHeader className="bg-primary/5">
                        <div className="flex items-center justify-between mb-2">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <Database className="h-6 w-6 text-primary" />
                            </div>
                            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">SQL DUMP</Badge>
                        </div>
                        <CardTitle className="text-xl">Full Database Export</CardTitle>
                        <CardDescription>Includes all tables, schemas, and data rows.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        <ul className="space-y-2.5">
                            <li className="flex items-center gap-2 text-sm text-muted-foreground">
                                <CheckCircle2 className="h-4 w-4 text-green-500" /> Complete data preservation
                            </li>
                            <li className="flex items-center gap-2 text-sm text-muted-foreground">
                                <CheckCircle2 className="h-4 w-4 text-green-500" /> Structure and sequences
                            </li>
                            <li className="flex items-center gap-2 text-sm text-muted-foreground">
                                <CheckCircle2 className="h-4 w-4 text-green-500" /> Full restoration compatibility
                            </li>
                        </ul>
                        <Button
                            className="w-full h-11 shadow-lg shadow-primary/10"
                            onClick={() => handleBackup('full')}
                            disabled={isGenerating !== null}
                        >
                            {isGenerating === 'full' ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Generating Dump...
                                </>
                            ) : (
                                <>
                                    <Download className="mr-2 h-4 w-4" />
                                    Download Full SQL (.sql)
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>

                <Card className="border-2 border-primary/5 hover:border-primary/10 transition-all overflow-hidden">
                    <CardHeader className="bg-muted/30">
                        <div className="flex items-center justify-between mb-2">
                            <div className="p-2 bg-muted rounded-lg text-muted-foreground">
                                <FileCode className="h-6 w-6" />
                            </div>
                            <Badge variant="outline" className="uppercase text-[10px]">Schema Only</Badge>
                        </div>
                        <CardTitle className="text-xl">Table Structure Only</CardTitle>
                        <CardDescription>Includes only the schema (tables, columns, indexes). No data rows.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        <ul className="space-y-2.5">
                            <li className="flex items-center gap-2 text-sm text-muted-foreground">
                                <CheckCircle2 className="h-4 w-4 text-green-500" /> Lightweight for migration
                            </li>
                            <li className="flex items-center gap-2 text-sm text-muted-foreground">
                                <CheckCircle2 className="h-4 w-4 text-green-500" /> Preserves indexes and constraints
                            </li>
                            <li className="flex items-center gap-2 text-sm text-muted-foreground">
                                <CheckCircle2 className="h-4 w-4 text-green-500" /> Ideal for cloning environments
                            </li>
                        </ul>
                        <Button
                            variant="secondary"
                            className="w-full h-11"
                            onClick={() => handleBackup('schema')}
                            disabled={isGenerating !== null}
                        >
                            {isGenerating === 'schema' ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <Download className="mr-2 h-4 w-4" />
                                    Download Schema Only
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl flex items-start gap-4">
                        <div className="p-2 bg-amber-500/10 rounded-lg">
                            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500" />
                        </div>
                        <div>
                            <p className="font-bold text-amber-700 dark:text-amber-500">Resource Usage Warning</p>
                            <p className="text-sm text-amber-900/60 dark:text-amber-500/60 leading-relaxed mt-1">
                                For very large databases (over 500MB), the direct browser download might take several minutes.
                                The system generates a fresh dump in real-time, which may temporarily increase disk I/O on your server.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <Card className="border-2 border-primary/5 bg-primary/5">
                        <CardContent className="pt-6 flex gap-4">
                            <div className="p-3 bg-primary/10 rounded-full h-fit">
                                <ShieldCheck className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <h3 className="font-bold">Automated Backups</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Did you know Neup.Cloud runs automated daily backups for all databases?
                                    You can restore from a previous state in the maintenance panel.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
