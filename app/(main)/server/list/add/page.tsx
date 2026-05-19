"use client";

import { type ChangeEvent, useMemo, useRef, useState } from "react";
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
import { createServer, checkServerConnection, generateSshKeyPair } from "@/services/server/server-service";
import { serializeServerMetadata } from "@/services/server/server-metadata";

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
    expiresAt: string;
};

const initialState: FormState = {
    name: "",
    username: "root",
    type: "Ubuntu 22.04",
    provider: "Custom",
    publicIp: "",
    privateIp: "",
    privateKey: "",
    publicKey: "",
    privateKeyPassphrase: "",
    expiresAt: "",
};

export default function AddServerPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [isCheckingConnection, setIsCheckingConnection] = useState(false);
    const [formData, setFormData] = useState<FormState>(initialState);
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
                publicIp: formData.publicIp,
                privateIp: formData.privateIp,
                privateKey: formData.privateKey,
                publicKey: formData.publicKey,
                moreDetails: serializeServerMetadata(undefined, {
                    expiresAt: formData.expiresAt || undefined,
                    sshPassphrase: hasPasskey ? formData.privateKeyPassphrase || undefined : undefined,
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

    const handleGenerateKeys = async () => {
        if (!canGenerate) return;

        setIsGeneratingKeys(true);
        try {
            const generated = await generateSshKeyPair({
                name: generatorName.trim(),
                algorithm: generatorAlgo,
                passphrase: generatorPassphrase,
            });

            const payload: Record<string, string> = {
                name: generatorName.trim(),
                public: generated.publicKey,
                private: generated.privateKey,
            };

            if (generatorPassphrase) {
                payload.passphrase = generatorPassphrase;
            }
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

                        <div className="grid gap-2">
                            <Label htmlFor="type">OS / type</Label>
                            <Input id="type" required value={formData.type} onChange={(event) => updateField("type", event.target.value)} placeholder="Ubuntu 22.04" />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="expiresAt">Expiration</Label>
                            <Input id="expiresAt" type="datetime-local" value={formData.expiresAt} onChange={(event) => updateField("expiresAt", event.target.value)} />
                            <p className="text-xs text-muted-foreground">Leave this blank if the server should stay active indefinitely.</p>
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
                                required
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
                                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                                className={`min-h-40 font-mono text-xs ${isPrivateKeyDragActive ? "ring-2 ring-primary ring-offset-2" : ""}`}
                            />
                            ) : null}
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
