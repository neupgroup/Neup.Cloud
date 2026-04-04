'use client';

import { PageTitleBack } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Download, KeyRound, Loader2 } from "lucide-react";
import { useState } from "react";
import { generateSSHKeyPair, addAuthorizedKey } from "../actions";
import { useToast } from '@/hooks/use-toast';
import { useRouter } from "next/navigation";
import { Separator } from "@/components/ui/separator";

export default function CreateKeyPage() {
    const { toast } = useToast();
    const router = useRouter();

    const [keyName, setKeyName] = useState('');
    const [publicKey, setPublicKey] = useState('');
    const [privateKey, setPrivateKey] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [downloaded, setDownloaded] = useState(false);

    const generateRandomName = () => {
        // We will import this dynamically or moving the logic here if simple. 
        // Let's us import useful helper.
        // Actually, since this is client side, I can just use the dictionary I created or a simple list if import fails.
        // But I made a file, let's try to import it.
        // Wait, standard import is top level.
        // For now, I'll assume I can just import getRandomWord from '@/lib/dictionary' at top level.
        return `generated-key-${Math.floor(Math.random() * 10000)}`;
    };

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            // Auto generate name if empty
            let nameToUse = keyName;
            if (!nameToUse) {
                const { getRandomWord } = await import('@/lib/dictionary');
                const word = getRandomWord();
                const number = Math.floor(1000 + Math.random() * 9000); // 4 digit number
                nameToUse = `${word}.${number}.key`;
                setKeyName(nameToUse);
            }

            const result = await generateSSHKeyPair(nameToUse);
            if (result.error) {
                toast({ variant: 'destructive', title: 'Generation Failed', description: result.error });
            } else if (result.publicKey && result.privateKey) {
                setPublicKey(result.publicKey);
                setPrivateKey(result.privateKey);
                setDownloaded(false);
                toast({ title: 'Key Pair Generated', description: `Generated key: ${nameToUse}. Please download private key.` });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = () => {
        if (!privateKey) return;
        const blob = new Blob([privateKey], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const filename = (keyName.replace(/[^a-zA-Z0-9-_\.]/g, '') || 'id_rsa');
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
        setDownloaded(true);
    };

    const handleSave = async () => {
        if (!keyName || !publicKey) {
            toast({ variant: 'destructive', title: 'Incomplete', description: 'Name and public key are required.' });
            return;
        }

        // If we generated a private key, allow saving ONLY if downloaded (or if user explicitly pasted a public key manually, then privateKey is null, so it's fine)
        if (privateKey && !downloaded) {
            toast({ variant: 'destructive', title: 'Download Required', description: 'Please download the private key before saving. It will not be shown again.' });
            return;
        }

        setIsSaving(true);

        // We need serverId. Since this is client component, we might need to get it via stored cookie or assume context.
        // But our actions use 'cookies()' which works in Server Actions called from Client Components. 
        // WAIT: 'cookies()' in Server Actions works fine. 
        // We need to fetch serverId from cookies in the action or pass it if the action requires it.
        // My `addAuthorizedKey` requires `serverId`.
        // Let's check how to get serverId here. We can parse document.cookie or pass it as prop if this was server component.
        // BUT this is 'use client'.
        // Better: Make a wrapper action `addAuthorizedKeyCurrentServer(publicKey)` that reads the cookie itself.
        // OR: Just read it from client side cookies if needed, but `getServerForRunner` in `actions.ts` usually takes ID.
        // Step back: `getAuthorizedKeys` in `actions.ts` takes `serverId`.
        // But `addAuthorizedKey` takes `serverId`.
        // I need to get `serverId`.

        // Simple hack for client side cookie reading:
        const getCookie = (name: string) => {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) return parts.pop()?.split(';').shift();
        };
        const serverId = getCookie('selected_server');

        if (!serverId) {
            toast({ variant: 'destructive', title: 'No Server Selected', description: 'Please select a server first.' });
            setIsSaving(false);
            return;
        }

        try {
            const result = await addAuthorizedKey(serverId, publicKey);
            if (result.error) {
                toast({ variant: 'destructive', title: 'Failed to add key', description: result.error });
            } else {
                toast({ title: 'Success', description: 'SSH Key added successfully.' });
                router.push('/server/firewall/keys');
                router.refresh();
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageTitleBack
                title="Add SSH Key"
                description="Authorize a new key for access."
                backHref="/server/firewall/keys"
            />

            <div className="max-w-2xl">
                <Card>
                    <CardHeader>
                        <CardTitle>Key Details</CardTitle>
                        <CardDescription>Generate a new key pair or paste an existing public key.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="key-name">Name / Comment</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="key-name"
                                    placeholder="e.g. Laptop Pro"
                                    value={keyName}
                                    onChange={(e) => setKeyName(e.target.value)}
                                    disabled={!!privateKey} // Lock name if generated to ensure consistency with comment in key? Optional.
                                />
                                <Button
                                    variant="outline"
                                    onClick={handleGenerate}
                                    disabled={isGenerating || !!privateKey}
                                    title="Generate a new RSA key pair"
                                >
                                    {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4 mr-2" />}
                                    Generate
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Leave blank to auto-generate a name, or enter a custom one.
                            </p>
                        </div>

                        {privateKey && (
                            <div className="rounded-lg border bg-muted/50 p-4 space-y-4 animate-in fade-in slide-in-from-top-2">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-semibold text-sm flex items-center gap-2">
                                        <KeyRound className="h-4 w-4 text-primary" />
                                        Private Key Generated
                                    </h4>
                                    <Button size="sm" variant={downloaded ? "secondary" : "default"} onClick={handleDownload}>
                                        <Download className="h-4 w-4 mr-2" />
                                        {downloaded ? "Downloaded" : "Download Private Key"}
                                    </Button>
                                </div>
                                <p className="text-xs text-destructive">
                                    <strong>Important:</strong> You must download this key now. It will not be shown again.
                                    The public key below has been automatically populated.
                                </p>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="public-key">Public Key</Label>
                            <Textarea
                                id="public-key"
                                placeholder="ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC..."
                                className="font-mono text-xs min-h-[150px]"
                                value={publicKey}
                                onChange={(e) => setPublicKey(e.target.value)}
                                readOnly={!!privateKey} // Read-only if generated
                            />
                            {!privateKey && (
                                <p className="text-xs text-muted-foreground">
                                    Paste your public key here (usually starts with ssh-rsa or ssh-ed25519).
                                </p>
                            )}
                        </div>

                        <Separator />

                        <Button
                            className="w-full sm:w-auto"
                            onClick={handleSave}
                            disabled={isSaving || (!!privateKey && !downloaded)}
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            {isSaving ? 'Saving...' : 'Authorize Key'}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
