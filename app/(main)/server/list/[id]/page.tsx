"use client";

import { type ChangeEvent, use, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock3, Loader2, ServerIcon, ShieldAlert, ShieldCheck } from "lucide-react";

import { ConfirmDialog } from "@/components/confirm-dialog";
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
import { cn } from "@/core/utils";
import { getServer, updateServer, checkServerConnection, generateSshKeyPair } from "@/services/server/server-service";
import type { Server } from "@/services/server/types";
import { getServerExpiration, getServerSshPassphrase, parseServerMetadata, serializeServerMetadata } from "@/services/server/server-metadata";

type FormState = {
    name: string;
    username: string;
    type: string;
    provider: string;
    publicIp: string;
    privateIp: string;
    privateKey: string;
    publicKey: string;
    privateKeyPassphrase: string;
};

function formatDate(value?: string | null) {
    if (!value) {
        return "No expiration set";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "Invalid expiration";
    }

    return date.toLocaleString();
}

function isExpired(value?: string | null) {
    if (!value) {
        return false;
    }

    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && date.getTime() <= Date.now();
}

function addExpirationMonths(baseValue: string | null | undefined, months: number) {
    const baseDate = baseValue ? new Date(baseValue) : new Date();

    if (Number.isNaN(baseDate.getTime())) {
        return new Date();
    }

    const nextDate = new Date(baseDate);
    nextDate.setMonth(nextDate.getMonth() + months);
    return nextDate;
}

export default function ServerDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const { toast } = useToast();
    const { id: serverId } = use(params);
    const [server, setServer] = useState<Server | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        const loadServer = async () => {
            setIsLoading(true);
            try {
                const data = await getServer(serverId);
                if (!cancelled) {
                    setServer(data);
                }
            } catch (error) {
                console.error(error);
                if (!cancelled) {
                    toast({
                        variant: "destructive",
                        title: "Could not load server",
                        description: "Please try again.",
                    });
                    setServer(null);
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        void loadServer();

        return () => {
            cancelled = true;
        };
    }, [serverId, toast]);

    if (isLoading) {
        return (
            <div className="mx-auto max-w-4xl space-y-6 py-10">
                <Button variant="ghost" className="w-fit px-0 text-muted-foreground hover:text-foreground" onClick={() => router.push("/server/list")}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to servers
                </Button>
                <Card>
                    <CardHeader>
                        <CardTitle>Loading server</CardTitle>
                        <CardDescription>Fetching the latest connection details.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
                        <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                        <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!server) {
        return (
            <div className="mx-auto max-w-4xl space-y-6 py-10">
                <Button variant="ghost" className="w-fit px-0 text-muted-foreground hover:text-foreground" onClick={() => router.push("/server/list")}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to servers
                </Button>
                <Card>
                    <CardHeader>
                        <CardTitle>Server not found</CardTitle>
                        <CardDescription>The server may have been removed or the link is outdated.</CardDescription>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    return <ServerDetailsForm server={server} />;
}

function ServerDetailsForm({ server }: { server: Server }) {
    const router = useRouter();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [isExpiring, setIsExpiring] = useState(false);
    const [isCheckingConnection, setIsCheckingConnection] = useState(false);
    const [serverState, setServerState] = useState(server);
    const [isPrivateKeyDragActive, setIsPrivateKeyDragActive] = useState(false);
    const [hasPasskey, setHasPasskey] = useState(false);
    const [isGenerateFlow, setIsGenerateFlow] = useState(false);
    const [generatorName, setGeneratorName] = useState("");
    const [generatorAlgo, setGeneratorAlgo] = useState<"ed25519" | "rsa" | "ecdsa">("ed25519");
    const [generatorPassphrase, setGeneratorPassphrase] = useState("");
    const [isGeneratingKeys, setIsGeneratingKeys] = useState(false);
    const [generatedBundle, setGeneratedBundle] = useState<{ privateKey: string; publicKey: string } | null>(null);
    const [hasDownloadedGeneratedFile, setHasDownloadedGeneratedFile] = useState(false);
    const privateKeyFileInputRef = useRef<HTMLInputElement | null>(null);

    const currentExpiration = getServerExpiration(serverState.moreDetails);
    const currentMetadata = useMemo(() => parseServerMetadata(serverState.moreDetails), [serverState.moreDetails]);
    const currentPassphrase = useMemo(() => getServerSshPassphrase(serverState.moreDetails) ?? "", [serverState.moreDetails]);
    const [formData, setFormData] = useState<FormState>({
        name: serverState.name,
        username: serverState.username,
        type: serverState.type,
        provider: serverState.provider,
        publicIp: serverState.publicIp,
        privateIp: serverState.privateIp ?? "",
        privateKey: "",
        publicKey: serverState.publicKey ?? "",
        privateKeyPassphrase: "",
    });

    useEffect(() => {
        setFormData({
            name: serverState.name,
            username: serverState.username,
            type: serverState.type,
            provider: serverState.provider,
            publicIp: serverState.publicIp,
            privateIp: serverState.privateIp ?? "",
            privateKey: "",
            publicKey: serverState.publicKey ?? "",
            privateKeyPassphrase: "",
        });
        setHasPasskey(Boolean(currentPassphrase));
    }, [currentExpiration, serverState]);

    const updateField = (name: keyof FormState, value: string) => {
        setFormData((current) => ({ ...current, [name]: value }));
    };

    const passkeyLabel = "Has passkey?";
    const canGenerate = useMemo(() => generatorName.trim().length > 0, [generatorName]);

    const importPrivateKeyFile = async (file: File) => {
        try {
            if (file.size > 512_000) {
                toast({
                    variant: "destructive",
                    title: "File too large",
                    description: "Please select a smaller private key file.",
                });
                return;
            }

            const text = await file.text();
            const trimmed = text.trim();
            if (!trimmed) {
                toast({
                    variant: "destructive",
                    title: "Empty file",
                    description: "The selected file does not contain an SSH private key.",
                });
                return;
            }

            let importedPrivateKey = trimmed;
            let importedPublicKey = "";
            let importedPassphrase = "";

            if (trimmed.startsWith("{")) {
                try {
                    const parsed = JSON.parse(trimmed) as {
                        private?: string;
                        public?: string;
                        passphrase?: string;
                    };

                    if (parsed.private?.trim()) {
                        importedPrivateKey = parsed.private.trim();
                        importedPublicKey = parsed.public?.trim() ?? "";
                        importedPassphrase = parsed.passphrase?.trim() ?? "";
                    }
                } catch {
                    // Fall back to plain key text handling.
                }
            }

            if (!importedPrivateKey) {
                toast({
                    variant: "destructive",
                    title: "Invalid key file",
                    description: "Could not find a valid private key in this file.",
                });
                return;
            }

            updateField("privateKey", importedPrivateKey);
            if (importedPublicKey) {
                updateField("publicKey", importedPublicKey);
            }
            if (importedPassphrase) {
                updateField("privateKeyPassphrase", importedPassphrase);
                setHasPasskey(true);
            }

            toast({
                title: "SSH key imported",
                description: `Loaded ${file.name}`,
            });
        } catch (error) {
            console.error(error);
            toast({
                variant: "destructive",
                title: "Import failed",
                description: "We could not read the selected key file.",
            });
        }
    };

    const handlePrivateKeyFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        await importPrivateKeyFile(file);
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsSaving(true);

        try {
            await updateServer(serverState.id, {
                name: formData.name,
                username: formData.username,
                type: formData.type,
                provider: formData.provider,
                publicIp: formData.publicIp,
                privateIp: formData.privateIp,
                privateKey: formData.privateKey,
                publicKey: formData.publicKey,
                moreDetails: serializeServerMetadata(serverState.moreDetails, {
                    ...currentMetadata,
                    sshPassphrase: hasPasskey ? formData.privateKeyPassphrase || currentPassphrase || undefined : undefined,
                }),
            });

            const refreshedServer = await getServer(serverState.id);
            if (refreshedServer) {
                setServerState(refreshedServer);
            }

            toast({
                title: "Server updated",
                description: "The server details were saved.",
            });
        } catch (error) {
            console.error(error);
            toast({
                variant: "destructive",
                title: "Update failed",
                description: "We could not save the server changes.",
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleExpireNow = async () => {
        await updateExpiration(new Date());
    };

    const updateExpiration = async (nextExpiration: Date | null) => {
        setIsExpiring(true);

        try {
            await updateServer(serverState.id, {
                moreDetails: serializeServerMetadata(serverState.moreDetails, {
                    ...currentMetadata,
                    expiresAt: nextExpiration ? nextExpiration.toISOString() : undefined,
                    sshPassphrase: currentPassphrase || undefined,
                }),
            });

            const refreshedServer = await getServer(serverState.id);
            if (refreshedServer) {
                setServerState(refreshedServer);
            }

            toast({
                title: nextExpiration ? "Expiration updated" : "Server expired",
                description: nextExpiration
                    ? "The server expiration was extended."
                    : "The server has been marked as expired.",
            });
        } catch (error) {
            console.error(error);
            toast({
                variant: "destructive",
                title: "Expiration update failed",
                description: "We could not update the server expiration.",
            });
        } finally {
            setIsExpiring(false);
        }
    };

    const handleExtendExpiration = async (months: number) => {
        const nextExpiration = addExpirationMonths(currentExpiration, months);
        await updateExpiration(nextExpiration);
    };

    const handleCheckConnection = async () => {
        setIsCheckingConnection(true);

        try {
            const result = await checkServerConnection(serverState.id);

            toast({
                title: result.success ? "Connection successful" : "Connection failed",
                description: result.message,
                variant: result.success ? "default" : "destructive",
            });
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

    const handleGenerateKeys = async () => {
        if (!canGenerate) return;

        setIsGeneratingKeys(true);
        try {
            const generated = await generateSshKeyPair({
                name: generatorName.trim(),
                algorithm: generatorAlgo,
                passphrase: generatorPassphrase,
            });

            setGeneratedBundle(generated);
            updateField("privateKey", generated.privateKey);
            updateField("publicKey", generated.publicKey);
            updateField("privateKeyPassphrase", generatorPassphrase);
            setHasPasskey(Boolean(generatorPassphrase));
            setHasDownloadedGeneratedFile(true);
            setIsGenerateFlow(false);
            toast({
                title: "SSH keys generated",
                description: "Fields have been filled with generated key data.",
            });
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Failed to generate keys",
                description: error instanceof Error ? error.message : "Please try again.",
            });
        } finally {
            setIsGeneratingKeys(false);
        }
    };

    const handleDownloadGeneratedKeys = () => {
        if (!generatedBundle) return;

        const payload: Record<string, string> = {
            name: generatorName.trim() || "ssh-key",
            public: generatedBundle.publicKey,
            private: generatedBundle.privateKey,
        };

        if (generatorPassphrase) {
            payload.passphrase = generatorPassphrase;
        }

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${payload.name}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="mx-auto max-w-4xl space-y-6 py-10">
            <Button variant="ghost" className="w-fit px-0 text-muted-foreground hover:text-foreground" onClick={() => router.push("/server/list")}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to servers
            </Button>

            <div className="space-y-2">
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">Server details</p>
                <h1 className="text-4xl font-bold tracking-tight">{serverState.name}</h1>
                <p className="text-muted-foreground">{serverState.username}@{serverState.publicIp} · {serverState.provider}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                    <CardContent className="flex items-center gap-3 p-4">
                        <ServerIcon className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <p className="text-sm text-muted-foreground">Provider</p>
                            <p className="font-medium">{server.provider}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-3 p-4">
                        <Clock3 className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <p className="text-sm text-muted-foreground">Status</p>
                            <p className="font-medium">{isExpired(currentExpiration) ? "Expired" : "Active"}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card 
                    className="cursor-pointer transition-colors hover:bg-accent"
                    onClick={handleCheckConnection}
                >
                    <CardContent className="flex items-center justify-between gap-3 p-4">
                        <div className="flex items-center gap-3">
                            <ShieldCheck className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <p className="text-sm text-muted-foreground">Connection</p>
                                <p className="text-sm font-medium">Check SSH access</p>
                            </div>
                        </div>
                        {isCheckingConnection && <Loader2 className="h-4 w-4 animate-spin" />}
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Expiration</CardTitle>
                    <CardDescription>Extend the current expiration or expire the server immediately.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" onClick={() => handleExtendExpiration(1)} disabled={isExpiring}>
                            Add 1 month
                        </Button>
                        <Button type="button" variant="outline" onClick={() => handleExtendExpiration(3)} disabled={isExpiring}>
                            Add 3 months
                        </Button>
                        <Button type="button" variant="outline" onClick={() => handleExtendExpiration(6)} disabled={isExpiring}>
                            Add 6 months
                        </Button>
                        <Button type="button" variant="outline" onClick={() => handleExtendExpiration(12)} disabled={isExpiring}>
                            Add 1 year
                        </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Current expiration: <span className="font-medium text-foreground">{formatDate(currentExpiration)}</span>
                    </p>
                </CardContent>
                <CardFooter className="justify-end border-t px-6 py-4">
                    <ConfirmDialog
                        trigger={
                            <Button type="button" variant="destructive" disabled={isExpiring}>
                                <ShieldAlert className="mr-2 h-4 w-4" />
                                Expire
                            </Button>
                        }
                        title="Expire this server?"
                        description="This will set the server expiration to now."
                        confirmLabel={isExpiring ? "Updating..." : "Expire"}
                        onConfirm={handleExpireNow}
                        loading={isExpiring}
                    />
                </CardFooter>
            </Card>

            <Card>
                <form onSubmit={handleSubmit}>
                    <CardHeader>
                        <CardTitle>Edit server</CardTitle>
                        <CardDescription>Update the SSH connection details or change when the server expires.</CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Server name</Label>
                            <Input id="name" required value={formData.name} onChange={(event) => updateField("name", event.target.value)} />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-2">
                                <Label htmlFor="publicIp">Public IP</Label>
                                <Input id="publicIp" required value={formData.publicIp} onChange={(event) => updateField("publicIp", event.target.value)} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="privateIp">Private IP</Label>
                                <Input id="privateIp" value={formData.privateIp} onChange={(event) => updateField("privateIp", event.target.value)} />
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

                        <div className="grid gap-2">
                            <Label htmlFor="type">OS / type</Label>
                            <Input id="type" required value={formData.type} onChange={(event) => updateField("type", event.target.value)} />
                        </div>

                        <div className="mt-8 grid gap-1.5">
                            <Label htmlFor="privateKey">SSH private key</Label>
                            <p className="text-xs text-muted-foreground">
                                Import an SSH key file or generate a new one.
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                                <input
                                    ref={privateKeyFileInputRef}
                                    type="file"
                                    accept=".pem,.key,.txt,.json,application/json,text/plain"
                                    className="hidden"
                                    onChange={handlePrivateKeyFileSelected}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => privateKeyFileInputRef.current?.click()}
                                    className="w-full sm:w-auto"
                                >
                                    Import key file
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full sm:w-auto"
                                    onClick={() => setIsGenerateFlow(true)}
                                >
                                    Generate key
                                </Button>
                            </div>
                            {isGenerateFlow ? (
                                <div className="rounded-md border bg-muted/20 p-4 space-y-3">
                                    <div>
                                        <p className="text-sm font-medium text-foreground">Generate SSH key</p>
                                        <p className="text-xs text-muted-foreground">Provide a key name, type, and optional passphrase.</p>
                                    </div>
                                    <div className="grid gap-3">
                                        <div className="grid gap-2">
                                            <Label htmlFor="generatorName">Name</Label>
                                            <Input
                                                id="generatorName"
                                                value={generatorName}
                                                onChange={(event) => setGeneratorName(event.target.value)}
                                                placeholder="mail-key"
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="generatorAlgo">Key type</Label>
                                            <Select value={generatorAlgo} onValueChange={(value: "ed25519" | "rsa" | "ecdsa") => setGeneratorAlgo(value)}>
                                                <SelectTrigger id="generatorAlgo">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="ed25519">Ed25519</SelectItem>
                                                    <SelectItem value="rsa">RSA 4096</SelectItem>
                                                    <SelectItem value="ecdsa">ECDSA 521</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="generatorPassphrase">Passphrase</Label>
                                            <Input
                                                id="generatorPassphrase"
                                                type="password"
                                                value={generatorPassphrase}
                                                onChange={(event) => setGeneratorPassphrase(event.target.value)}
                                                placeholder="Keep this empty to not have a passphrase"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button type="button" variant="outline" onClick={() => setIsGenerateFlow(false)}>
                                            Cancel
                                        </Button>
                                        <Button type="button" disabled={!canGenerate || isGeneratingKeys} onClick={handleGenerateKeys}>
                                            {isGeneratingKeys ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                            Generate
                                        </Button>
                                    </div>
                                </div>
                            ) : null}
                            {!isGenerateFlow ? (
                            <Textarea
                                id="privateKey"
                                value={formData.privateKey}
                                onChange={(event) => updateField("privateKey", event.target.value)}
                                onDragEnter={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setIsPrivateKeyDragActive(true);
                                }}
                                onDragOver={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setIsPrivateKeyDragActive(true);
                                }}
                                onDragLeave={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setIsPrivateKeyDragActive(false);
                                }}
                                onDrop={async (event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setIsPrivateKeyDragActive(false);
                                    const file = event.dataTransfer.files?.[0];
                                    if (!file) return;
                                    await importPrivateKeyFile(file);
                                }}
                                placeholder="Leave blank to keep the existing key"
                                className={`min-h-40 font-mono text-xs ${isPrivateKeyDragActive ? "ring-2 ring-primary ring-offset-2" : ""}`}
                            />
                            ) : null}
                            <p className="text-xs text-muted-foreground">Only enter a new private key if you want to replace the existing one.</p>
                        </div>

                        {!isGenerateFlow ? (
                        <div className="grid gap-2">
                            {(
                                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                                    <input
                                        type="checkbox"
                                        checked={hasPasskey}
                                        onChange={(event) => setHasPasskey(event.target.checked)}
                                    />
                                    {passkeyLabel}
                                </label>
                            )}

                            {hasPasskey ? (
                                <>
                                    <Label htmlFor="privateKeyPassphrase">Passphrase</Label>
                                    <Input
                                        id="privateKeyPassphrase"
                                        type="password"
                                        value={formData.privateKeyPassphrase}
                                        onChange={(event) => updateField("privateKeyPassphrase", event.target.value)}
                                        placeholder="Enter passphrase"
                                    />
                                </>
                            ) : null}

                        </div>
                        ) : null}

                        {!isGenerateFlow ? (
                        <div className="grid gap-2">
                            <Label htmlFor="publicKey">Public key</Label>
                            <Textarea
                                id="publicKey"
                                value={formData.publicKey}
                                onChange={(event) => updateField("publicKey", event.target.value)}
                                placeholder="ssh-ed25519 AAAA..."
                                className="min-h-24 font-mono text-xs"
                            />
                        </div>
                        ) : null}

                        {!isGenerateFlow && hasDownloadedGeneratedFile ? (
                        <div className="flex justify-start">
                            <Button type="button" variant="outline" onClick={handleDownloadGeneratedKeys}>
                                Download key data
                            </Button>
                        </div>
                        ) : null}
                    </CardContent>

                    <CardFooter className="flex flex-col gap-2 border-t px-6 py-4 sm:flex-row sm:justify-between">
                        <ConfirmDialog
                            trigger={
                                <Button type="button" variant="destructive" className="w-full sm:w-auto">
                                    <ShieldAlert className="mr-2 h-4 w-4" />
                                    Expire now
                                </Button>
                            }
                            title="Expire this server?"
                            description="This will mark the server as expired in its metadata. You can move the expiration date later by editing the server."
                            confirmLabel={isExpiring ? "Expiring..." : "Expire now"}
                            onConfirm={handleExpireNow}
                            loading={isExpiring}
                        />

                        <div className="flex flex-col gap-2 sm:flex-row">
                            <Button type="button" variant="ghost" onClick={() => router.push("/server/list")}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Save changes
                            </Button>
                        </div>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
