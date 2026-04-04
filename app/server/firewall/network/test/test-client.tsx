'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Play, RotateCcw, AlertCircle, CheckCircle2, XCircle, Clock, ShieldAlert, Plus } from 'lucide-react';
import { checkPortConnectivity } from '../../actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const COMMON_PORTS = [
    { port: 22, name: 'SSH', description: 'Secure Shell' },
    { port: 80, name: 'HTTP', description: 'Web traffic' },
    { port: 443, name: 'HTTPS', description: 'Secure web traffic' },
    { port: 21, name: 'FTP', description: 'File transfer' },
    { port: 3306, name: 'MySQL', description: 'Database' },
    { port: 5432, name: 'PostgreSQL', description: 'Database' },
    { port: 6379, name: 'Redis', description: 'Cache' },
    { port: 27017, name: 'MongoDB', description: 'Database' },
    { port: 8080, name: 'HTTP-Alt', description: 'Web traffic alt' },
    { port: 3000, name: 'Dev', description: 'App development' },
];

type TestResult = {
    port: number;
    status: 'pending' | 'testing' | 'open' | 'closed' | 'blocked' | 'error';
    message: string;
    latency?: number;
};

export default function NetworkTestClient({ serverId }: { serverId: string }) {
    const { toast } = useToast();
    const [results, setResults] = useState<Record<number, TestResult>>({});
    const [customPort, setCustomPort] = useState('');
    const [customPorts, setCustomPorts] = useState<{ port: number, name: string, description: string }[]>([]);
    const [isTestingAll, setIsTestingAll] = useState(false);

    const testPort = async (port: number) => {
        setResults(prev => ({
            ...prev,
            [port]: { port, status: 'testing', message: 'Testing connectivity...' }
        }));

        try {
            const result = await checkPortConnectivity(serverId, port);
            setResults(prev => ({
                ...prev,
                [port]: {
                    port,
                    status: result.status,
                    message: result.message,
                    latency: result.latency
                }
            }));
        } catch (error: any) {
            setResults(prev => ({
                ...prev,
                [port]: { port, status: 'error', message: error.message }
            }));
        }
    };

    const testAllCommon = async () => {
        setIsTestingAll(true);
        for (const item of COMMON_PORTS) {
            await testPort(item.port);
        }
        setIsTestingAll(false);
    };

    const handleCustomTest = (e: React.FormEvent) => {
        e.preventDefault();
        const portNum = parseInt(customPort);
        if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
            toast({ variant: 'destructive', title: 'Invalid Port', description: 'Please enter a valid port between 1 and 65535.' });
            return;
        }

        // Check if it's already in common or custom
        const isCommon = COMMON_PORTS.some(p => p.port === portNum);
        const isAlreadyCustom = customPorts.some(p => p.port === portNum);

        if (!isCommon && !isAlreadyCustom) {
            setCustomPorts(prev => [{ port: portNum, name: 'Custom', description: 'User defined port' }, ...prev]);
        }

        testPort(portNum);
        setCustomPort('');
    };

    const getStatusIcon = (status: TestResult['status']) => {
        switch (status) {
            case 'open': return <CheckCircle2 className="h-5 w-5 text-green-500" />;
            case 'closed': return <CheckCircle2 className="h-5 w-5 text-green-600" />;
            case 'blocked': return <ShieldAlert className="h-5 w-5 text-destructive" />;
            case 'error': return <XCircle className="h-5 w-5 text-destructive" />;
            case 'testing': return <RotateCcw className="h-5 w-5 animate-spin text-primary" />;
            default: return <Clock className="h-5 w-5 text-muted-foreground" />;
        }
    };

    const getStatusBadge = (status: TestResult['status']) => {
        switch (status) {
            case 'open': return <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/10 border-green-500/20">Connected</Badge>;
            case 'closed': return <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/10 border-green-500/20">Receiving</Badge>;
            case 'blocked': return <Badge variant="destructive" className="bg-destructive/10 text-destructive hover:bg-destructive/10 border-destructive/20">Blocked</Badge>;
            case 'error': return <Badge variant="destructive">Error</Badge>;
            case 'testing': return <Badge variant="secondary" className="animate-pulse">Checking...</Badge>;
            default: return <Badge variant="outline">Pending</Badge>;
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Actions */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card p-6 rounded-xl border shadow-sm">
                <div>
                    <h2 className="text-xl font-semibold">Firewall Connectivity Tester</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Verify if your server's ports are reachable from the network.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button onClick={testAllCommon} disabled={isTestingAll}>
                        {isTestingAll ? (
                            <RotateCcw className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Play className="mr-2 h-4 w-4" />
                        )}
                        Test All Common Ports
                    </Button>
                </div>
            </div>

            {/* Test Matrix */}
            <Card className="divide-y divide-border overflow-hidden">
                {/* Custom Test Input Card */}
                <div className="p-6 bg-muted/20 border-l-4 border-l-blue-500/50">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="space-y-1">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                                <Plus className="h-4 w-4 text-blue-500" />
                                Test Custom Port
                            </h3>
                            <p className="text-xs text-muted-foreground">Enter any port number (1-65535) to verify if it's reachable.</p>
                        </div>
                        <form onSubmit={handleCustomTest} className="flex items-center gap-3">
                            <Input
                                placeholder="Port (e.g. 5000)"
                                type="number"
                                className="w-full md:w-40 h-10"
                                value={customPort}
                                onChange={(e) => setCustomPort(e.target.value)}
                                min={1}
                                max={65535}
                            />
                            <Button type="submit" className="shrink-0 h-10 px-6">
                                Run Test
                            </Button>
                        </form>
                    </div>
                </div>

                {[...customPorts, ...COMMON_PORTS].map((item) => {
                    const result = results[item.port];
                    return (
                        <div
                            key={item.port}
                            onClick={() => result?.status !== 'testing' && testPort(item.port)}
                            className={cn(
                                "p-4 transition-all duration-300 hover:bg-muted/50 flex flex-col md:flex-row md:items-center justify-between gap-4 border-l-4 cursor-pointer select-none active:bg-muted/70",
                                result?.status === 'open' ? "border-l-green-500" :
                                    result?.status === 'closed' ? "border-l-green-500/50" :
                                        result?.status === 'blocked' ? "border-l-destructive" :
                                            "border-l-transparent",
                                result?.status === 'testing' && "opacity-70 cursor-not-allowed"
                            )}
                        >
                            <div className="flex-1 flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg font-bold tracking-tight">{item.port}</span>
                                    <span className="text-sm font-medium text-muted-foreground uppercase">{item.name}</span>
                                </div>

                                <div className="flex items-center gap-2 group/msg">
                                    <div className="shrink-0">
                                        {getStatusIcon(result?.status || 'pending')}
                                    </div>
                                    <div className={cn(
                                        "text-sm flex items-center gap-2",
                                        !result || result.status === 'pending' ? "text-muted-foreground" :
                                            result.status === 'open' || result.status === 'closed' ? "text-green-600 font-medium" :
                                                result.status === 'testing' ? "text-primary animate-pulse" :
                                                    "text-destructive font-medium"
                                    )}>
                                        <span>
                                            {!result || result.status === 'pending' ? "Untested" :
                                                result.status === 'testing' ? "Checking connectivity..." :
                                                    result.message}
                                        </span>

                                        {result?.latency !== undefined && (
                                            <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                                                {result.latency}ms
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                {getStatusBadge(result?.status || 'pending')}
                                {result?.status === 'testing' ? (
                                    <RotateCcw className="h-4 w-4 animate-spin text-primary" />
                                ) : (
                                    <Play className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                )}
                            </div>
                        </div>
                    );
                })}
            </Card>

            {/* Results Legend & Guide */}
            <Card className="p-6 bg-muted/30 border-dashed">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Understanding the Results
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-green-600 font-medium">
                            <CheckCircle2 className="h-4 w-4" /> Receiving
                        </div>
                        <p className="text-muted-foreground leading-relaxed">
                            The server is <b>receiving packets</b> on this port. The firewall is clear. If an app is listening, it will handle the request; otherwise, the OS simply acknowledges receipt.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-destructive font-medium">
                            <ShieldAlert className="h-4 w-4" /> Not Receiving / Blocked
                        </div>
                        <p className="text-muted-foreground leading-relaxed">
                            The request <b>did not reach the server</b>. We analyze your UFW rules to tell you if the OS firewall is responsible or if it is an external block.
                        </p>
                    </div>
                </div>
            </Card>
        </div>
    );

}
