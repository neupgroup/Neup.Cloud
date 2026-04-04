'use client';

import { useState } from 'react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Terminal, Play, Trash2, Clock, Database, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageTitleBack } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from '@/hooks/use-toast';

import { executeDatabaseQuery } from '@/actions/database';

interface ShellClientProps {
    id: string;
    dbName: string;
    engine: 'mariadb' | 'postgres';
    serverId: string;
}

export function ShellClient({ id, dbName, engine, serverId }: ShellClientProps) {
    const { toast } = useToast();
    const [query, setQuery] = useState('');
    const [isExecuting, setIsExecuting] = useState(false);
    const [result, setResult] = useState<{
        success: boolean;
        data?: any[];
        message?: string;
        executionTime?: number;
        rowCount?: number;
    } | null>(null);

    const handleExecute = async () => {
        if (!query.trim()) {
            toast({
                variant: 'destructive',
                title: 'Empty Query',
                description: 'Please enter a SQL query to execute.',
            });
            return;
        }

        setIsExecuting(true);
        setResult(null);

        try {
            const result = await executeDatabaseQuery(serverId, engine, dbName, query);

            if (result.success) {
                setResult({
                    success: true,
                    data: result.data,
                    executionTime: result.executionTime,
                    rowCount: result.rowCount,
                    message: result.message
                });

                toast({
                    title: 'Query Executed',
                    description: `Success: ${result.rowCount} rows affected.`,
                });
            } else {
                setResult({
                    success: false,
                    message: result.message
                });
                toast({
                    variant: 'destructive',
                    title: 'Execution Failed',
                    description: result.message || 'Failed to execute query.',
                });
            }
        } catch (error: any) {
            setResult({
                success: false,
                message: error.message || 'Failed to execute query'
            });
            toast({
                variant: 'destructive',
                title: 'Execution Failed',
                description: error.message || 'Failed to execute query.',
            });
        } finally {
            setIsExecuting(false);
        }
    };

    const handleClear = () => {
        setQuery('');
        setResult(null);
    };

    const quickQueries = engine === 'mariadb' ? [
        { label: 'Show Tables', query: 'SHOW TABLES;' },
        { label: 'Show Databases', query: 'SHOW DATABASES;' },
        { label: 'Show Users', query: 'SELECT User, Host FROM mysql.user;' },
        { label: 'Table Info', query: 'DESCRIBE table_name;' },
    ] : [
        { label: 'List Tables', query: '\\dt' },
        { label: 'List Databases', query: '\\l' },
        { label: 'List Users', query: '\\du' },
        { label: 'Table Info', query: '\\d table_name' },
    ];

    return (
        <div className="grid gap-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20">
            <PageTitleBack
                backHref={`/server/database/${id}`}
                title={
                    <span className="flex items-center gap-3">
                        <span className="p-2.5 bg-primary/10 rounded-xl">
                            <Terminal className="w-6 h-6 text-primary" />
                        </span>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className="font-bold tracking-tight">SQL Shell</span>
                                <Badge variant="outline" className="text-[10px] uppercase bg-primary/5 text-primary border-primary/20">
                                    {engine}
                                </Badge>
                            </div>
                            <span className="text-sm font-normal text-muted-foreground">{dbName}</span>
                        </div>
                    </span>
                }
            />

            {/* Warning Notice */}
            <Card className="border-2 border-amber-500/20 bg-amber-500/5">
                <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                        <div className="p-2 rounded-lg bg-amber-500/10">
                            <AlertCircle className="h-5 w-5 text-amber-500" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold mb-1 text-amber-900 dark:text-amber-500">Production Database</h3>
                            <p className="text-sm text-amber-900/70 dark:text-amber-500/70">
                                You are connected to a live production database. All queries will be executed immediately. Use caution with UPDATE, DELETE, and DROP statements.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Query Editor */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Database className="h-5 w-5 text-primary" />
                                Query Editor
                            </CardTitle>
                            <CardDescription>
                                Write and execute SQL queries against your database
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleClear}
                                disabled={isExecuting}
                                className="gap-2"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                Clear
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleExecute}
                                disabled={isExecuting || !query.trim()}
                                className="gap-2"
                            >
                                {isExecuting ? (
                                    <>
                                        <Clock className="h-3.5 w-3.5 animate-spin" />
                                        Executing...
                                    </>
                                ) : (
                                    <>
                                        <Play className="h-3.5 w-3.5" />
                                        Execute
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Textarea
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={`Enter your ${engine.toUpperCase()} query here...\n\nExample:\nSELECT * FROM users LIMIT 10;`}
                        className="min-h-[200px] font-mono text-sm"
                        disabled={isExecuting}
                    />

                    {/* Quick Queries */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">Quick Queries</label>
                        <div className="flex flex-wrap gap-2">
                            {quickQueries.map((q, idx) => (
                                <Button
                                    key={idx}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setQuery(q.query)}
                                    disabled={isExecuting}
                                    className="text-xs"
                                >
                                    {q.label}
                                </Button>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Query Result */}
            {result && (
                <Card className={result.success ? 'border-2 border-green-500/20' : 'border-2 border-red-500/20'}>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                {result.success ? (
                                    <>
                                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                                        Query Result
                                    </>
                                ) : (
                                    <>
                                        <AlertCircle className="h-5 w-5 text-red-500" />
                                        Error
                                    </>
                                )}
                            </CardTitle>
                            {result.success && result.executionTime && (
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                        <Clock className="h-3.5 w-3.5" />
                                        {result.executionTime}s
                                    </span>
                                    {result.rowCount !== undefined && (
                                        <Badge variant="secondary" className="text-[10px]">
                                            {result.rowCount} rows
                                        </Badge>
                                    )}
                                </div>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        {result.success && result.data ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/50">
                                            {Object.keys(result.data[0] || {}).map((key) => (
                                                <th key={key} className="text-left p-3 font-medium">
                                                    {key}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {result.data.map((row, idx) => (
                                            <tr key={idx} className="border-b hover:bg-muted/30">
                                                {Object.values(row).map((value: any, vidx) => (
                                                    <td key={vidx} className="p-3 font-mono text-xs">
                                                        {value?.toString() || 'NULL'}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-4 bg-red-500/5 rounded-lg">
                                <p className="text-sm text-red-900 dark:text-red-400 font-mono">
                                    {result.message}
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Tips */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Tips & Shortcuts</CardTitle>
                </CardHeader>
                <CardContent>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex items-start gap-2">
                            <span className="text-primary">•</span>
                            <span>Press <kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono">Ctrl+Enter</kbd> to execute the query</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-primary">•</span>
                            <span>Use semicolons (;) to separate multiple statements</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-primary">•</span>
                            <span>Results are limited to 1000 rows for performance</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-primary">•</span>
                            <span>Session timeout is set to 30 minutes of inactivity</span>
                        </li>
                    </ul>
                </CardContent>
            </Card>
        </div>
    );
}
