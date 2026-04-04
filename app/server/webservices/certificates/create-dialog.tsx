'use client';

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from '@/hooks/use-toast';
import { FileCode, Loader2, Plus, RefreshCw, Shield, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { generateSslCertificate } from "../nginx/actions";
import { Textarea } from "@/components/ui/textarea";

interface CreateCertificateDialogProps {
    serverId: string | null; // We might need to pass this or get it from cookie in action
    onSuccess: () => void;
}

export function CreateCertificateDialog({ onSuccess }: CreateCertificateDialogProps) {
    const { toast } = useToast();
    const [open, setOpen] = useState(false);

    // Form State
    const [mainDomain, setMainDomain] = useState('');
    const [subdomains, setSubdomains] = useState('');
    const [includeWildcard, setIncludeWildcard] = useState(false);

    // Process State
    const [generating, setGenerating] = useState(false);
    const [step, setStep] = useState<'input' | 'dns-challenge'>('input');
    const [dnsData, setDnsData] = useState<{ challenge: string; dnsRecord: string } | null>(null);

    // We can rely on the cookie for server ID in the action, but specific UI might want to know it. 
    // For now, the action `generateSslCertificate` takes a serverId.
    // We need to fetch the server ID from the cookie client-side or pass it down.
    // The parent page uses an action that reads the cookie. 
    // Let's assume we can get it from the parent or we'll fetch it here.
    // Actually, `generateSslCertificate` is a server action, but it REQUIRES serverId as argument.
    // We should get the server ID. 

    // Helper to get cookie client side
    const getServerId = () => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; selected_server=`);
        if (parts.length === 2) return parts.pop()?.split(';').shift();
        return null;
    };

    const handleGenerate = async (currentStep: 'init' | 'finalize-dns' = 'init') => {
        const serverId = getServerId();
        if (!serverId) {
            toast({ variant: 'destructive', title: 'Error', description: 'No server selected.' });
            return;
        }

        if (!mainDomain) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please enter the main domain.' });
            return;
        }

        setGenerating(true);
        try {
            // Construct domain list
            // 1. Root domain (mainDomain)
            const domainList = [mainDomain.trim()];

            // 2. Wildcard if selected
            if (includeWildcard) {
                domainList.push(`*.${mainDomain.trim()}`);
            }

            // 3. Subdomains
            if (subdomains.trim()) {
                const subs = subdomains.split(/[\n, ]+/).map(s => s.trim()).filter(s => s);
                subs.forEach(sub => {
                    // Detect if user typed full domain (sub.example.com) or just sub (sub)
                    // If it ends with the main domain, keep it, else append
                    let fullSub = sub;
                    if (!sub.endsWith(mainDomain.trim())) {
                        fullSub = `${sub}.${mainDomain.trim()}`;
                    }
                    if (fullSub !== mainDomain.trim()) { // avoid duplicate root
                        domainList.push(fullSub);
                    }
                });
            }

            // Deduplicate
            const uniqueDomains = Array.from(new Set(domainList));

            // Use main domain as the certificate name (configName)
            const configName = mainDomain.trim();

            // @ts-ignore
            const result = await generateSslCertificate(
                serverId,
                uniqueDomains,
                configName,
                currentStep
            );

            if (result.success) {
                if (result.actionRequired === 'dns-verification') {
                    setDnsData({
                        challenge: result.challenge,
                        dnsRecord: result.dnsRecord
                    });
                    setStep('dns-challenge');
                    toast({
                        title: 'DNS Verification Required',
                        description: result.message,
                    });
                } else {
                    toast({
                        title: 'Success',
                        description: result.message,
                    });
                    setOpen(false);
                    // Do not reset form immediately so user can see what they did if they reopen? 
                    // Better to reset.
                    resetForm();
                    onSuccess();
                }
            } else {
                toast({
                    variant: 'destructive',
                    title: 'Error',
                    description: result.error,
                });
            }
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.message || 'Failed to generate certificate',
            });
        } finally {
            setGenerating(false);
        }
    };

    const resetForm = () => {
        setMainDomain('');
        setSubdomains('');
        setIncludeWildcard(false);
        setStep('input');
        setDnsData(null);
    };

    return (
        <Dialog open={open} onOpenChange={(v) => {
            setOpen(v);
            if (!v) resetForm(); // Optional: reset on close? Or keep state? safe to reset.
        }}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Certificate
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Create SSL Certificate</DialogTitle>
                    <DialogDescription>
                        Generate a new Link's Encrypt SSL certificate.
                    </DialogDescription>
                </DialogHeader>

                {step === 'input' && (
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="mainDomain">Main Domain</Label>
                            <Input
                                id="mainDomain"
                                placeholder="example.com"
                                value={mainDomain}
                                onChange={(e) => setMainDomain(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">The certificate will be named after this domain.</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="subdomains">Additional Subdomains (Optional)</Label>
                            <Textarea
                                id="subdomains"
                                placeholder="www&#10;api&#10;blog"
                                value={subdomains}
                                onChange={(e) => setSubdomains(e.target.value)}
                                className="font-mono"
                                rows={2}
                            />
                            <p className="text-xs text-muted-foreground">
                                Enter specific subdomains (e.g. 'www') separated by newlines.
                            </p>
                        </div>

                        <div className="flex items-center space-x-2 pt-2">
                            <Checkbox
                                id="wildcard"
                                checked={includeWildcard}
                                onCheckedChange={(v) => setIncludeWildcard(v as boolean)}
                            />
                            <div className="grid gap-1.5 leading-none">
                                <Label
                                    htmlFor="wildcard"
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                    Include Wildcard (*.{mainDomain || 'domain.com'})
                                </Label>
                                <p className="text-[11px] text-muted-foreground">
                                    Requires DNS verification (manual TXT record).
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {step === 'dns-challenge' && dnsData && (
                    <div className="space-y-4 py-4">
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 space-y-3">
                            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold text-xs uppercase tracking-wide">
                                <ShieldAlert className="h-4 w-4" /> Action Required: DNS Verification
                            </div>

                            <p className="text-sm text-foreground font-medium">
                                1. Add this TXT record to your DNS provider:
                            </p>

                            <div className="grid gap-3 pl-2 border-l-2 border-amber-500/20 ml-1">
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase text-muted-foreground">Record Name (Host)</Label>
                                    <div className="flex gap-2">
                                        <code className="flex-1 bg-background border px-2 py-1.5 rounded text-xs font-mono truncate">
                                            {dnsData.dnsRecord}
                                        </code>
                                        <Button
                                            size="icon"
                                            variant="outline"
                                            className="h-7 w-7"
                                            onClick={() => {
                                                navigator.clipboard.writeText(dnsData.dnsRecord);
                                                toast({ title: 'Copied' });
                                            }}
                                        >
                                            <FileCode className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase text-muted-foreground">Record Value</Label>
                                    <div className="flex gap-2">
                                        <code className="flex-1 bg-background border px-2 py-1.5 rounded text-xs font-mono break-all">
                                            {dnsData.challenge}
                                        </code>
                                        <Button
                                            size="icon"
                                            variant="outline"
                                            className="h-7 w-7"
                                            onClick={() => {
                                                navigator.clipboard.writeText(dnsData.challenge);
                                                toast({ title: 'Copied' });
                                            }}
                                        >
                                            <FileCode className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <p className="text-sm text-foreground font-medium pt-2">
                                2. Wait a moment for DNS propagation, then click the button below to complete verification.
                            </p>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    {step === 'input' ? (
                        <Button onClick={() => handleGenerate('init')} disabled={generating}>
                            {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Generate Certificate
                        </Button>
                    ) : (
                        <div className="flex w-full gap-2">
                            <Button variant="ghost" onClick={() => setStep('input')} disabled={generating}>
                                Back
                            </Button>
                            <Button className="flex-1" onClick={() => handleGenerate('finalize-dns')} disabled={generating}>
                                {generating ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Verifying...
                                    </>
                                ) : (
                                    <>
                                        <Shield className="mr-2 h-4 w-4" />
                                        Verify & Complete
                                    </>
                                )}
                            </Button>
                        </div>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
