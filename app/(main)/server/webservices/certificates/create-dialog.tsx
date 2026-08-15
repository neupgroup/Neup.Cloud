'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/core/hooks/use-toast';
import { ExternalLink, FileCode, Loader2, Plus, Shield, ShieldAlert, Terminal, Trash2 } from 'lucide-react';
import { generateSslCertificate, getWildcardCertificateSession } from '@/services/webservices/nginx/service';

interface CreateCertificateDialogProps {
    serverId: string | null;
    onSuccess: () => void;
}

interface WildcardTerminalSession {
    sessionId: string;
    configName: string;
    mainDomain: string;
    dnsRecord: string;
    challenge: string;
}

function createSessionId() {
    return `acme-${Math.random().toString(36).slice(2, 10)}`;
}

function buildSessionStorageKey(serverId: string, configName: string) {
    return `neup:certificates:wildcard:${serverId}:${configName}`;
}

function buildLatestSessionStorageKey(serverId: string) {
    return `neup:certificates:wildcard:latest:${serverId}`;
}

function buildLiveTerminalHref(serverId: string, sessionId: string) {
    const params = new URLSearchParams({
        selectedServer: serverId,
        sessionId,
        acme: '1',
    });

    return `/server/commands/live?${params.toString()}`;
}

export function CreateCertificateDialog({ serverId: serverIdFromProps, onSuccess }: CreateCertificateDialogProps) {
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const [mainDomain, setMainDomain] = useState('');
    const [subdomains, setSubdomains] = useState('');
    const [includeWildcard, setIncludeWildcard] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [step, setStep] = useState<'input' | 'dns-challenge'>('input');
    const [dnsData, setDnsData] = useState<{ challenge: string; dnsRecord: string } | null>(null);
    const [terminalSession, setTerminalSession] = useState<WildcardTerminalSession | null>(null);
    const [savedSession, setSavedSession] = useState<WildcardTerminalSession | null>(null);

    const [fallbackServerId, setFallbackServerId] = useState<string | null>(null);
    const serverId = serverIdFromProps || fallbackServerId;

    useEffect(() => {
        if (serverIdFromProps || typeof document === 'undefined') {
            return;
        }

        const value = `; ${document.cookie}`;
        const parts = value.split(`; selected_server=`);
        if (parts.length === 2) {
            setFallbackServerId(parts.pop()?.split(';').shift() || null);
        }
    }, [serverIdFromProps]);

    const persistSession = (session: WildcardTerminalSession) => {
        if (!serverId) {
            return;
        }

        const storageKey = buildSessionStorageKey(serverId, session.configName);
        const latestKey = buildLatestSessionStorageKey(serverId);
        sessionStorage.setItem(storageKey, JSON.stringify(session));
        sessionStorage.setItem(latestKey, storageKey);
        setSavedSession(session);
    };

    const clearPersistedSession = (session?: WildcardTerminalSession | null) => {
        if (!serverId || !session) {
            return;
        }

        const storageKey = buildSessionStorageKey(serverId, session.configName);
        const latestKey = buildLatestSessionStorageKey(serverId);
        sessionStorage.removeItem(storageKey);

        const latestValue = sessionStorage.getItem(latestKey);
        if (latestValue === storageKey) {
            sessionStorage.removeItem(latestKey);
        }
    };

    const restoreSavedSession = (session: WildcardTerminalSession) => {
        setMainDomain(session.mainDomain);
        setIncludeWildcard(true);
        setTerminalSession(session);
        setDnsData({
            challenge: session.challenge,
            dnsRecord: session.dnsRecord,
        });
        setStep('dns-challenge');
    };

    useEffect(() => {
        if (!open || !serverId) {
            return;
        }

        const latestKey = buildLatestSessionStorageKey(serverId);
        const latestStorageKey = sessionStorage.getItem(latestKey);
        if (!latestStorageKey) {
            setSavedSession(null);
            return;
        }

        const raw = sessionStorage.getItem(latestStorageKey);
        if (!raw) {
            setSavedSession(null);
            sessionStorage.removeItem(latestKey);
            return;
        }

        try {
            const parsed = JSON.parse(raw) as WildcardTerminalSession;
            setSavedSession(parsed);
        } catch {
            setSavedSession(null);
            sessionStorage.removeItem(latestStorageKey);
            sessionStorage.removeItem(latestKey);
        }
    }, [open, serverId]);

    const resetForm = () => {
        setMainDomain('');
        setSubdomains('');
        setIncludeWildcard(false);
        setStep('input');
        setDnsData(null);
        setTerminalSession(null);
    };

    const buildDomainList = () => {
        const normalizedMainDomain = mainDomain.trim();
        const domainList = [normalizedMainDomain];

        if (includeWildcard) {
            domainList.push(`*.${normalizedMainDomain}`);
        }

        if (subdomains.trim()) {
            const subs = subdomains.split(/[\n, ]+/).map((value) => value.trim()).filter(Boolean);
            for (const sub of subs) {
                const fullSub = sub.endsWith(normalizedMainDomain) ? sub : `${sub}.${normalizedMainDomain}`;
                if (fullSub !== normalizedMainDomain) {
                    domainList.push(fullSub);
                }
            }
        }

        return Array.from(new Set(domainList));
    };

    const handleGenerate = async (currentStep: 'init' | 'finalize-dns' = 'init') => {
        if (!serverId) {
            toast({ variant: 'destructive', title: 'Error', description: 'No server selected.' });
            return;
        }

        const normalizedMainDomain = mainDomain.trim();
        if (!normalizedMainDomain) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please enter the main domain.' });
            return;
        }

        const uniqueDomains = buildDomainList();
        const configName = normalizedMainDomain;
        const nextSessionId = terminalSession?.sessionId || createSessionId();

        setGenerating(true);
        try {
            const result = await generateSslCertificate(
                serverId,
                uniqueDomains,
                configName,
                currentStep,
                includeWildcard ? nextSessionId : undefined
            );

            if (!result.success) {
                toast({
                    variant: 'destructive',
                    title: 'Error',
                    description: result.error,
                });
                return;
            }

            if (result.actionRequired === 'dns-verification') {
                const nextTerminalSession: WildcardTerminalSession = {
                    sessionId: result.sessionId || nextSessionId,
                    configName,
                    mainDomain: normalizedMainDomain,
                    dnsRecord: result.dnsRecord,
                    challenge: result.challenge,
                };

                setTerminalSession(nextTerminalSession);
                setDnsData({
                    challenge: result.challenge,
                    dnsRecord: result.dnsRecord,
                });
                setStep('dns-challenge');
                persistSession(nextTerminalSession);
                toast({
                    title: 'DNS Verification Required',
                    description: 'Wildcard certificates now use a resumable terminal session.',
                });
                return;
            }

            clearPersistedSession(terminalSession);
            toast({
                title: 'Success',
                description: result.message,
            });
            setOpen(false);
            resetForm();
            onSuccess();
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

    const openTerminal = () => {
        if (!serverId || !terminalSession) {
            return;
        }

        window.open(buildLiveTerminalHref(serverId, terminalSession.sessionId), '_blank', 'noopener,noreferrer');
    };

    const handleResumeSavedSession = async () => {
        if (!savedSession) {
            return;
        }

        try {
            const session = await getWildcardCertificateSession(savedSession.sessionId);
            if (!session) {
                clearPersistedSession(savedSession);
                setSavedSession(null);
                toast({
                    variant: 'destructive',
                    title: 'Session Missing',
                    description: 'The saved wildcard verification session could not be found.',
                });
                return;
            }

            restoreSavedSession({
                sessionId: savedSession.sessionId,
                configName: session.configName,
                mainDomain: session.configName,
                dnsRecord: session.dnsRecord,
                challenge: session.challenge,
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Resume Failed',
                description: error.message || 'Failed to load the saved wildcard session.',
            });
        }
    };

    const handleDiscardSavedSession = () => {
        clearPersistedSession(savedSession);
        setSavedSession(null);
        if (terminalSession?.sessionId === savedSession?.sessionId) {
            setTerminalSession(null);
            setDnsData(null);
            setStep('input');
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(value) => {
                setOpen(value);
                if (!value) {
                    resetForm();
                }
            }}
        >
            <DialogTrigger asChild>
                <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Certificate
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Create SSL Certificate</DialogTitle>
                    <DialogDescription>
                        Generate a new Let's Encrypt SSL certificate.
                    </DialogDescription>
                </DialogHeader>

                {step === 'input' && (
                    <div className="space-y-4 py-4">
                        {savedSession && (
                            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-medium text-foreground">Saved wildcard verification session</p>
                                        <p className="text-xs text-muted-foreground">
                                            {savedSession.mainDomain} · session <code>{savedSession.sessionId}</code>
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button type="button" variant="outline" size="sm" onClick={handleResumeSavedSession}>
                                            Resume
                                        </Button>
                                        <Button type="button" variant="ghost" size="sm" onClick={handleDiscardSavedSession}>
                                            <Trash2 className="h-4 w-4 mr-1" />
                                            Clear
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

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
                                Enter specific subdomains separated by new lines, spaces, or commas.
                            </p>
                        </div>

                        <div className="flex items-center space-x-2 pt-2">
                            <Checkbox
                                id="wildcard"
                                checked={includeWildcard}
                                onCheckedChange={(value) => setIncludeWildcard(Boolean(value))}
                            />
                            <div className="grid gap-1.5 leading-none">
                                <Label htmlFor="wildcard" className="text-sm font-medium leading-none">
                                    Include Wildcard (*.{mainDomain || 'domain.com'})
                                </Label>
                                <p className="text-[11px] text-muted-foreground">
                                    Requires DNS verification and opens a resumable interactive terminal session.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {step === 'dns-challenge' && dnsData && terminalSession && (
                    <div className="space-y-4 py-4">
                        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 space-y-3">
                            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold text-xs uppercase tracking-wide">
                                <ShieldAlert className="h-4 w-4" />
                                Action Required: DNS Verification
                            </div>

                            <p className="text-sm text-foreground font-medium">
                                This wildcard request is paused in a live terminal session until you verify the ACME TXT record.
                            </p>

                            <div className="grid gap-3">
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase text-muted-foreground">Session ID</Label>
                                    <code className="block rounded border bg-background px-2 py-1.5 text-xs font-mono break-all">
                                        {terminalSession.sessionId}
                                    </code>
                                </div>

                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase text-muted-foreground">Record Name (Host)</Label>
                                    <div className="flex gap-2">
                                        <code className="flex-1 rounded border bg-background px-2 py-1.5 text-xs font-mono truncate">
                                            {dnsData.dnsRecord}
                                        </code>
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="outline"
                                            className="h-8 w-8"
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
                                        <code className="flex-1 rounded border bg-background px-2 py-1.5 text-xs font-mono break-all">
                                            {dnsData.challenge}
                                        </code>
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="outline"
                                            className="h-8 w-8"
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

                            <div className="flex flex-wrap gap-2 pt-2">
                                <Button type="button" variant="outline" onClick={openTerminal}>
                                    <Terminal className="h-4 w-4 mr-2" />
                                    Open Terminal
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => {
                                        navigator.clipboard.writeText(terminalSession.sessionId);
                                        toast({ title: 'Session ID copied' });
                                    }}
                                >
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    Copy Session ID
                                </Button>
                            </div>
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
                            <Button variant="outline" onClick={openTerminal} disabled={generating || !terminalSession}>
                                <Terminal className="mr-2 h-4 w-4" />
                                Open Terminal
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
