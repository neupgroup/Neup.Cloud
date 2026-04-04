'use client';

import { useState } from 'react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Globe } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { saveDatabaseSettings, type DatabaseSettings } from "@/actions/database";
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

type RemoteConnectionSettingsProps = {
    serverId: string;
    engine: 'mariadb' | 'postgres';
    dbName: string;
    initialSettings: DatabaseSettings | null;
};

export function RemoteConnectionSettings({ serverId, engine, dbName, initialSettings }: RemoteConnectionSettingsProps) {
    const router = useRouter();
    const { toast } = useToast();
    const [remoteAccess, setRemoteAccess] = useState(initialSettings?.remoteAccess ?? true);
    const [allowAllHosts, setAllowAllHosts] = useState(initialSettings?.allowAllHosts ?? true);
    const [allowedIps, setAllowedIps] = useState(initialSettings?.allowedIps ?? '0.0.0.0/0');
    const [sslRequired, setSslRequired] = useState(initialSettings?.sslRequired ?? true);
    const [isSaving, setIsSaving] = useState(false);

    const handleAllowAllHostsChange = (checked: boolean) => {
        setAllowAllHosts(checked);
        if (checked) {
            setAllowedIps('0.0.0.0/0');
        } else {
            setAllowedIps('');
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const result = await saveDatabaseSettings(serverId, engine, {
                remoteAccess,
                allowAllHosts,
                allowedIps,
                sslRequired
            });

            if (result.success) {
                toast({
                    title: "Success",
                    description: result.message,
                });
                router.refresh();
            } else {
                toast({
                    title: "Error",
                    description: result.message,
                    variant: "destructive",
                });
            }
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || 'Failed to save settings',
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-primary" />
                    <CardTitle>Remote Connection</CardTitle>
                </div>
                <CardDescription>
                    Control external access to this database instance
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                    <div className="space-y-0.5">
                        <Label htmlFor="remote-access" className="text-base font-semibold">
                            Enable Remote Access
                        </Label>
                        <p className="text-sm text-muted-foreground">
                            Allow connections from external IP addresses
                        </p>
                    </div>
                    <Switch
                        id="remote-access"
                        checked={remoteAccess}
                        onCheckedChange={setRemoteAccess}
                    />
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                        <div className="space-y-0.5">
                            <Label htmlFor="allow-all-hosts" className="text-base font-semibold">
                                Allow Connections from All Hosts
                            </Label>
                            <p className="text-sm text-muted-foreground">
                                Accept connections from any IP address (0.0.0.0/0)
                            </p>
                        </div>
                        <Switch
                            id="allow-all-hosts"
                            checked={allowAllHosts}
                            onCheckedChange={handleAllowAllHostsChange}
                            disabled={!remoteAccess}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="allowed-ips">Allowed IP Addresses</Label>
                        <Input
                            id="allowed-ips"
                            placeholder="0.0.0.0/0 (All IPs)"
                            value={allowedIps}
                            onChange={(e) => setAllowedIps(e.target.value)}
                            disabled={allowAllHosts || !remoteAccess}
                            className="font-mono text-sm disabled:opacity-50"
                        />
                        <p className="text-xs text-muted-foreground">
                            Comma-separated list of IP addresses or CIDR blocks. Use 0.0.0.0/0 for all IPs.
                        </p>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                        <div className="space-y-0.5">
                            <Label htmlFor="ssl-required" className="text-base font-semibold">
                                Require SSL/TLS
                            </Label>
                            <p className="text-sm text-muted-foreground">
                                Force encrypted connections only (recommended)
                            </p>
                        </div>
                        <Switch
                            id="ssl-required"
                            checked={sslRequired}
                            onCheckedChange={setSslRequired}
                            disabled={!remoteAccess}
                        />
                    </div>
                </div>

                <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-lg">
                    <p className="text-xs text-blue-900/70 dark:text-blue-500/70">
                        <strong>Note:</strong> SSL/TLS encryption is highly recommended for security. Disabling it may expose your database to security risks. Changes to remote access settings may take up to 60 seconds to apply.
                    </p>
                </div>

                <div className="flex justify-end">
                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        size="lg"
                        className="px-8"
                    >
                        {isSaving ? 'Saving...' : 'Save Settings'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
