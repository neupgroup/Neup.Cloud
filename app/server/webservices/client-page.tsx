'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'universal-cookie';
import { getServer } from '@/app/servers/actions';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Globe, Wind, Server, ArrowRight, Settings, FileKey } from 'lucide-react';
import Link from 'next/link';

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageTitle } from '@/components/page-header';

export default function WebServicesPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [serverId, setServerId] = useState<string | null>(null);
    const [server, setServer] = useState<any>(null);

    useEffect(() => {
        const fetchServer = async () => {
            const cookies = new Cookies(null, { path: '/' });
            const id = cookies.get('selected_server');

            if (!id) {
                toast({
                    variant: "destructive",
                    title: "No Server Selected",
                    description: "Please select a server first.",
                });
                router.push('/servers');
                return;
            }

            try {
                setServerId(id);
                const data = await getServer(id);
                if (data) {
                    setServer(data);
                }
            } catch (error) {
                console.error("Failed to fetch server:", error);
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: "Failed to load server data.",
                });
            } finally {
                setLoading(false);
            }
        };

        fetchServer();
    }, [router, toast]);

    if (loading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!server) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
                <h2 className="text-xl font-medium">Server not found</h2>
                <Button asChild><Link href="/servers">Go to Servers</Link></Button>
            </div>
        )
    }

    return (
        <div className="grid gap-8 animate-in fade-in duration-500 pb-10">
            <PageTitle
                title="Web Services"
                description="Manage web server and proxy configurations"
                serverName={server.name}
            />

            <div className="space-y-4">
                <div>
                    <h2 className="text-2xl font-medium font-headline tracking-tight">Quick Access</h2>
                    <p className="text-muted-foreground">Open key webservices pages in one click</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                        <Link href="/server/webservices/configure">
                            <div className="p-4 flex items-center gap-4">
                                <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                                    <Settings className="h-5 w-5 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium mb-0.5">Configure</p>
                                    <p className="text-xs text-muted-foreground">
                                        Configure proxy handler, load balancer, and network settings
                                    </p>
                                </div>
                                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                            </div>
                        </Link>
                    </Card>

                    <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                        <Link href="/server/webservices/certificates">
                            <div className="p-4 flex items-center gap-4">
                                <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                                    <FileKey className="h-5 w-5 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium mb-0.5">Certificates</p>
                                    <p className="text-xs text-muted-foreground">
                                        Manage SSL/TLS certificates and domain bindings
                                    </p>
                                </div>
                                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                            </div>
                        </Link>
                    </Card>
                </div>
            </div>

            <div className="space-y-4">
                <div>
                    <h2 className="text-2xl font-medium font-headline tracking-tight">Proxy Management</h2>
                    <p className="text-muted-foreground">Configure reverse proxy and routing rules</p>
                </div>

                {server.proxyHandler === 'Nginx' ? (
                    <div className="grid gap-4">
                        <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                            <Link href="/server/webservices/nginx">
                                <div className="p-4 flex items-center gap-4">
                                    <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                                        <Globe className="h-5 w-5 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium mb-0.5">Path Routing Configuration</p>
                                        <p className="text-xs text-muted-foreground">
                                            Configure Nginx locations, proxy passes, and custom headers
                                        </p>
                                    </div>
                                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                </div>
                            </Link>
                        </Card>
                        <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                            <Link href="/server/commands">
                                <div className="p-4 flex items-center gap-4">
                                    <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                                        <Server className="h-5 w-5 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium mb-0.5">Terminal Access</p>
                                        <p className="text-xs text-muted-foreground">
                                            Directly manage Nginx via command line interface
                                        </p>
                                    </div>
                                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                </div>
                            </Link>
                        </Card>
                    </div>
                ) : (
                    <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                        <Link href="/server/commands">
                            <div className="p-4 flex items-center gap-4">
                                <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                                    <Server className="h-5 w-5 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium mb-0.5">Terminal Access</p>
                                    <p className="text-xs text-muted-foreground">
                                        Manage your proxy configuration via command line interface
                                    </p>
                                </div>
                                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                            </div>
                        </Link>
                    </Card>
                )}
            </div>

            <div className="space-y-4">
                <div>
                    <h2 className="text-2xl font-medium font-headline tracking-tight">Load Balancer Management</h2>
                    <p className="text-muted-foreground">Distribute traffic across multiple servers</p>
                </div>

                {server.loadBalancer === 'Nginx' ? (
                    <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                        <Link href="/server/commands">
                            <div className="p-4 flex items-center gap-4">
                                <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                                    <Wind className="h-5 w-5 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium mb-0.5">Load Balancer Configuration</p>
                                    <p className="text-xs text-muted-foreground">
                                        Manage upstream servers and balancing rules
                                    </p>
                                </div>
                                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                            </div>
                        </Link>
                    </Card>
                ) : (
                    <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                        <Link href="/server/commands">
                            <div className="p-4 flex items-center gap-4">
                                <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                                    <Server className="h-5 w-5 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium mb-0.5">Terminal Access</p>
                                    <p className="text-xs text-muted-foreground">
                                        Manage your load balancer configuration via command line interface
                                    </p>
                                </div>
                                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                            </div>
                        </Link>
                    </Card>
                )}
            </div>

        </div>
    );
}