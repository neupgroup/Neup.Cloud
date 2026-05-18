"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/core/hooks/use-toast";
import { createServer, checkServerConnection } from "@/services/server/server-service";
import { serializeServerMetadata } from "@/services/server/server-metadata";

type FormState = {
    name: string;
    username: string;
    type: string;
    provider: string;
    ram: string;
    storage: string;
    publicIp: string;
    privateIp: string;
    privateKey: string;
    privateKeyPassphrase: string;
    expiresAt: string;
};

const initialState: FormState = {
    name: "",
    username: "root",
    type: "Ubuntu 22.04",
    provider: "Custom",
    ram: "2GB",
    storage: "40GB",
    publicIp: "",
    privateIp: "",
    privateKey: "",
    privateKeyPassphrase: "",
    expiresAt: "",
};

export default function AddServerPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [isCheckingConnection, setIsCheckingConnection] = useState(false);
    const [formData, setFormData] = useState<FormState>(initialState);

    const updateField = (name: keyof FormState, value: string) => {
        setFormData((current) => ({ ...current, [name]: value }));
    };

    const handleCheckConnection = async () => {
        if (!formData.publicIp || !formData.username || !formData.privateKey) {
            toast({
                variant: "destructive",
                title: "Missing required fields",
                description: "Please fill in Public IP, Username, and SSH private key.",
            });
            return;
        }

        setIsCheckingConnection(true);

        try {
            // Create temporary server record to test connection
            const tempServerId = `temp-${Date.now()}`;
            const tempServer = {
                id: tempServerId,
                name: formData.name || "Test",
                username: formData.username,
                type: formData.type,
                provider: formData.provider,
                publicIp: formData.publicIp,
                privateIp: formData.privateIp || "",
                privateKey: formData.privateKey,
                moreDetails: serializeServerMetadata(undefined, {
                    sshPassphrase: formData.privateKeyPassphrase || undefined,
                }),
            };

            // Import and run connection test directly since we can't use checkServerConnection without a real DB record
            const { runCommandOnServer } = await import("@/services/server/ssh");
            const { getServerSshPassphrase } = await import("@/services/server/server-metadata");
            const passphrase = getServerSshPassphrase(tempServer.moreDetails);

            const result = await runCommandOnServer(
                tempServer.publicIp,
                tempServer.username,
                tempServer.privateKey,
                'echo "Connection test successful"',
                undefined,
                undefined,
                false,
                {},
                passphrase ?? undefined
            );

            if (result.code === 0) {
                toast({
                    title: "Connection successful",
                    description: "The server is reachable via SSH.",
                });
            } else {
                toast({
                    variant: "destructive",
                    title: "Connection failed",
                    description: result.stderr || "Could not connect to the server.",
                });
            }
        } catch (error) {
            console.error(error);
            toast({
                variant: "destructive",
                title: "Connection check failed",
                description: error instanceof Error ? error.message : "Unable to check connection.",
            });
        } finally {
            setIsCheckingConnection(false);
        }
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsLoading(true);

        try {
            await createServer({
                name: formData.name,
                username: formData.username,
                type: formData.type,
                provider: formData.provider,
                ram: formData.ram,
                storage: formData.storage,
                publicIp: formData.publicIp,
                privateIp: formData.privateIp,
                privateKey: formData.privateKey,
                moreDetails: serializeServerMetadata(undefined, {
                    expiresAt: formData.expiresAt || undefined,
                    sshPassphrase: formData.privateKeyPassphrase || undefined,
                }),
            });

            toast({
                title: "Server created",
                description: "The new server has been added.",
            });
            router.push("/server/list");
        } catch (error) {
            console.error(error);
            toast({
                variant: "destructive",
                title: "Create failed",
                description: "We could not create the server.",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="mx-auto max-w-3xl space-y-6 py-10">
            <div className="space-y-2">
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">Server management</p>
                <h1 className="text-4xl font-bold tracking-tight">Add server</h1>
                <p className="text-muted-foreground">Register a new server, store its SSH details, and optionally set an expiration date.</p>
            </div>

            <Card>
                <form onSubmit={handleSubmit}>
                    <CardHeader>
                        <CardTitle>Server details</CardTitle>
                        <CardDescription>Enter the connection details for the server you want to manage.</CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Server name</Label>
                            <Input id="name" required value={formData.name} onChange={(event) => updateField("name", event.target.value)} placeholder="production-01" />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-2">
                                <Label htmlFor="publicIp">Public IP</Label>
                                <Input id="publicIp" required value={formData.publicIp} onChange={(event) => updateField("publicIp", event.target.value)} placeholder="1.2.3.4" />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="privateIp">Private IP</Label>
                                <Input id="privateIp" value={formData.privateIp} onChange={(event) => updateField("privateIp", event.target.value)} placeholder="10.0.0.10" />
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-2">
                                <Label htmlFor="username">Username</Label>
                                <Input id="username" required value={formData.username} onChange={(event) => updateField("username", event.target.value)} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="provider">Provider</Label>
                                <Select value={formData.provider} onValueChange={(value) => updateField("provider", value)}>
                                    <SelectTrigger id="provider">
                                        <SelectValue placeholder="Select provider" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Custom">Custom / Other</SelectItem>
                                        <SelectItem value="DigitalOcean">DigitalOcean</SelectItem>
                                        <SelectItem value="AWS">AWS</SelectItem>
                                        <SelectItem value="Hetzner">Hetzner</SelectItem>
                                        <SelectItem value="Vultr">Vultr</SelectItem>
                                        <SelectItem value="Linode">Linode</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-2">
                                <Label htmlFor="type">OS / type</Label>
                                <Input id="type" required value={formData.type} onChange={(event) => updateField("type", event.target.value)} placeholder="Ubuntu 22.04" />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="ram">RAM</Label>
                                <Input id="ram" value={formData.ram} onChange={(event) => updateField("ram", event.target.value)} placeholder="4GB" />
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="storage">Storage</Label>
                            <Input id="storage" value={formData.storage} onChange={(event) => updateField("storage", event.target.value)} placeholder="40GB" />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="expiresAt">Expiration</Label>
                            <Input id="expiresAt" type="datetime-local" value={formData.expiresAt} onChange={(event) => updateField("expiresAt", event.target.value)} />
                            <p className="text-xs text-muted-foreground">Leave this blank if the server should stay active indefinitely.</p>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="privateKey">SSH private key</Label>
                            <Textarea
                                id="privateKey"
                                required
                                value={formData.privateKey}
                                onChange={(event) => updateField("privateKey", event.target.value)}
                                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                                className="min-h-40 font-mono text-xs"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="privateKeyPassphrase">SSH key passphrase</Label>
                            <Input
                                id="privateKeyPassphrase"
                                type="password"
                                value={formData.privateKeyPassphrase}
                                onChange={(event) => updateField("privateKeyPassphrase", event.target.value)}
                                placeholder="Leave blank if the key is not encrypted"
                            />
                            <p className="text-xs text-muted-foreground">Required when the SSH private key is encrypted.</p>
                        </div>
                    </CardContent>

                    <CardFooter className="flex flex-col-reverse gap-2 border-t px-6 py-4 sm:flex-row sm:justify-end">
                        <Button variant="ghost" type="button" onClick={() => router.back()}>
                            Cancel
                        </Button>
                        <Button 
                            type="button" 
                            variant="outline"
                            disabled={isLoading || isCheckingConnection}
                            onClick={handleCheckConnection}
                        >
                            {isCheckingConnection ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Checking...
                                </>
                            ) : (
                                "Check connection"
                            )}
                        </Button>
                        <Button type="submit" disabled={isLoading || isCheckingConnection}>
                            {isLoading ? "Creating..." : "Create server"}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
