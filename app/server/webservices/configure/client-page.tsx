'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'universal-cookie';
import { getServer, updateServer } from '@/app/servers/actions';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';

import { PageTitleBack } from '@/components/page-header';

const PROXY_OPTIONS = ['Nginx', 'Apache', 'Caddy', 'Traefik'];
const LB_OPTIONS = ['Nginx', 'HAProxy', 'Traefik', 'AWS ELB', 'Google Cloud LB'];

export default function ServerSettingsPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [serverId, setServerId] = useState<string | null>(null);
    const [serverName, setServerName] = useState('');
    const [serverIp, setServerIp] = useState('');

    const [proxyHandler, setProxyHandler] = useState('');
    const [customProxy, setCustomProxy] = useState('');

    const [loadBalancer, setLoadBalancer] = useState('');
    const [customBalancer, setCustomBalancer] = useState('');

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
                    setServerName(data.name);
                    setServerIp(data.publicIp || '');

                    // Handle Proxy Handler
                    if (data.proxyHandler) {
                        if (PROXY_OPTIONS.includes(data.proxyHandler)) {
                            setProxyHandler(data.proxyHandler);
                        } else {
                            setProxyHandler('Custom');
                            setCustomProxy(data.proxyHandler);
                        }
                    }

                    // Handle Load Balancer
                    if (data.loadBalancer) {
                        if (LB_OPTIONS.includes(data.loadBalancer)) {
                            setLoadBalancer(data.loadBalancer);
                        } else {
                            setLoadBalancer('Custom');
                            setCustomBalancer(data.loadBalancer);
                        }
                    }
                }
            } catch (error) {
                console.error("Failed to fetch server:", error);
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: "Failed to load server settings.",
                });
            } finally {
                setLoading(false);
            }
        };

        fetchServer();
    }, [router, toast]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!serverId) return;

        setSaving(true);
        try {
            const finalProxy = proxyHandler === 'Custom' ? customProxy : proxyHandler;
            const finalBalancer = loadBalancer === 'Custom' ? customBalancer : loadBalancer;

            await updateServer(serverId, {
                proxyHandler: finalProxy,
                loadBalancer: finalBalancer,
            });

            toast({
                title: "Settings Saved",
                description: "Server configuration has been updated.",
            });
        } catch (error) {
            console.error("Failed to save settings:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to save settings.",
            });
        } finally {
            setSaving(false);
        }
    };




    if (loading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="grid gap-6 animate-in fade-in duration-500 pb-10">
            <PageTitleBack
                title="Server Settings"
                description={`Configuration for ${serverName}`}
                backHref="/server/webservices"
            />

            <form onSubmit={handleSave}>
                <div className="grid gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Network Configuration</CardTitle>
                            <CardDescription>
                                Configure how traffic is handled on this server.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-6">

                            {/* Proxy Handler Section */}
                            <div className="grid gap-2">
                                <Label htmlFor="proxy-handler" className="text-base font-semibold">Choose your proxy handler</Label>
                                <Select value={proxyHandler} onValueChange={setProxyHandler}>
                                    <SelectTrigger id="proxy-handler">
                                        <SelectValue placeholder="Select a proxy handler" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PROXY_OPTIONS.map((opt) => (
                                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                        ))}
                                        <SelectItem value="Custom">Custom</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {proxyHandler === 'Custom' && (
                                <div className="grid gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <Label htmlFor="custom-proxy" className="text-sm text-muted-foreground">Custom Proxy Name</Label>
                                    <Input
                                        id="custom-proxy"
                                        placeholder="e.g. MyCustomProxy"
                                        value={customProxy}
                                        onChange={(e) => setCustomProxy(e.target.value)}
                                    />
                                </div>
                            )}

                            <div className="h-px bg-border" />

                            {/* Load Balancer Section */}
                            <div className="grid gap-2">
                                <Label htmlFor="load-balancer" className="text-base font-semibold">Choose your load balancer</Label>
                                <Select value={loadBalancer} onValueChange={setLoadBalancer}>
                                    <SelectTrigger id="load-balancer">
                                        <SelectValue placeholder="Select a load balancer" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {LB_OPTIONS.map((opt) => (
                                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                        ))}
                                        <SelectItem value="Custom">Custom</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {loadBalancer === 'Custom' && (
                                <div className="grid gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <Label htmlFor="custom-balancer" className="text-sm text-muted-foreground">Custom Load Balancer Name</Label>
                                    <Input
                                        id="custom-balancer"
                                        placeholder="e.g. MyCustomLB"
                                        value={customBalancer}
                                        onChange={(e) => setCustomBalancer(e.target.value)}
                                    />
                                </div>
                            )}

                        </CardContent>
                        <CardFooter className="border-t px-6 py-4 flex justify-end">
                            <Button type="submit" disabled={saving}>
                                {saving ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Save Changes
                                    </>
                                )}
                            </Button>
                        </CardFooter>
                    </Card>

                </div>
            </form>
        </div>
    );
}
