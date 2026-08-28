'use client';

import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Skeleton } from "#/components/ui/skeleton";
import { Card } from "#/components/ui/card";
import { Trash2, Copy, Check } from "lucide-react";
import { useParams } from 'next/navigation';
import { cn } from "@/core/utils";
import { getDomain, getDomainDNSRecords, getDomainNameservers, verifyDomain, deleteDomain } from '@/services/domains/domains-service';
import type { ManagedDomain, DNSRecord } from '@/services/domains/types';
import { useEffect, useState } from "react";
import { PageTitleBack } from "@/components/page-header";
import { useToast } from '@/core/hooks/useToast';
import { useRouter } from "next/navigation";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "#/components/ui/alert-dialog";

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-8 w-8 p-0"
        >
            {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
        </Button>
    );
}

export default function DomainDetailsPage() {
    const params = useParams();
    const id = params.id as string;
    const { toast } = useToast();
    const router = useRouter();

    const [domain, setDomain] = useState<ManagedDomain | null>(null);
    const [dnsRecords, setDnsRecords] = useState<DNSRecord[]>([]);
    const [nameservers, setNameservers] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [verifying, setVerifying] = useState(false);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        async function loadAll() {
            try {
                const [domainData, dnsData, nsData] = await Promise.all([
                    getDomain(id),
                    getDomainDNSRecords(id),
                    getDomainNameservers(id)
                ]);
                setDomain(domainData);
                setDnsRecords(dnsData);
                setNameservers(nsData);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        loadAll();
    }, [id]);

    const handleRefresh = async () => {
        setLoading(true);
        try {
            const [domainData, dnsData, nsData] = await Promise.all([
                getDomain(id),
                getDomainDNSRecords(id),
                getDomainNameservers(id)
            ]);
            setDomain(domainData);
            setDnsRecords(dnsData);
            setNameservers(nsData);
            toast({ title: "Refreshed", description: "Domain data has been refreshed" });
        } catch (e) {
            console.error(e);
            toast({ variant: "destructive", title: "Error", description: "Failed to refresh domain data" });
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async () => {
        setVerifying(true);
        try {
            const result = await verifyDomain(id);
            if (result.success) {
                toast({ title: "Success", description: result.message });
                // Reload all domain data including DNS records
                const [domainData, dnsData] = await Promise.all([
                    getDomain(id),
                    getDomainDNSRecords(id)
                ]);
                setDomain(domainData);
                setDnsRecords(dnsData);
            } else {
                toast({ variant: "destructive", title: "Verification Failed", description: result.message });
            }
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Failed to verify domain" });
        } finally {
            setVerifying(false);
        }
    };

    const handleDelete = async () => {
        setDeleting(true);
        try {
            const result = await deleteDomain(id);
            if (result.success) {
                toast({ title: "Success", description: result.message });
                router.push('/domains');
            } else {
                toast({ variant: "destructive", title: "Error", description: result.message });
            }
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Failed to delete domain" });
        } finally {
            setDeleting(false);
        }
    };

    // Auto-verify on page load if domain is not verified
    useEffect(() => {
        async function autoVerify() {
            if (domain && !domain.verified && domain.verificationCode) {
                // Silently check verification status
                try {
                    const result = await verifyDomain(id);
                    if (result.success) {
                        const domainData = await getDomain(id);
                        setDomain(domainData);
                    }
                } catch (error) {
                    // Silently fail - user can manually verify
                    console.log('Auto-verification check failed:', error);
                }
            }
        }
        if (!loading && domain) {
            autoVerify();
        }
    }, [loading, domain?.id]); // Only run when loading completes

    const domainName = domain?.name || "Unknown Domain";
    const isUsingNeupCloud = nameservers.some(ns => ns.includes('neup.cloud'));
    const verificationRecord = domain?.verificationCode ? `neup.verify.${domain.verificationCode}` : '';

    return (
        <div className="space-y-8 pb-10">
            <PageTitleBack
                title={loading ? "Loading..." : domainName}
                description="Manage your domain settings, DNS, and nameservers"
                backHref="/domains"
            />

            {/* Overview */}
            <div className="space-y-4">
                <h2 className="text-lg font-semibold">Overview</h2>
                {loading ? (
                    <Card>
                        <div className="p-6">
                            <div className="grid gap-6 md:grid-cols-3">
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-16" />
                                    <Skeleton className="h-6 w-20" />
                                </div>
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-20" />
                                    <Skeleton className="h-6 w-32" />
                                </div>
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-24" />
                                    <Skeleton className="h-6 w-40" />
                                </div>
                            </div>
                        </div>
                    </Card>
                ) : domain ? (
                    <Card>
                        <div className="p-6 space-y-6">
                            <div className="grid gap-6 md:grid-cols-3">
                                <div className="space-y-1">
                                    <p className="text-sm text-muted-foreground">Status</p>
                                    <Badge
                                        variant={domain.status === 'active' ? 'default' : domain.status === 'pending' ? 'secondary' : 'destructive'}
                                        className="capitalize"
                                    >
                                        {domain.status}
                                    </Badge>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm text-muted-foreground">Added On</p>
                                    <p className="font-medium">{new Date(domain.addedAt).toLocaleDateString()}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm text-muted-foreground">Verification</p>
                                    <Badge variant={domain.verified ? 'default' : 'outline'}>
                                        {domain.verified ? 'Verified' : 'Not Verified'}
                                    </Badge>
                                </div>
                            </div>

                            {/* Verification Instructions - Only show if not verified */}
                            {!domain.verified && domain.verificationCode && (
                                <div className="pt-4 border-t space-y-3">
                                    <p className="text-sm font-medium">Add the following to your DNS in TXT record to verify:</p>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 flex items-center justify-between p-3 rounded-lg border bg-muted/50">
                                            <code className="text-sm font-mono break-all">{verificationRecord}</code>
                                            <CopyButton text={verificationRecord} />
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between gap-4">
                                        <p className="text-xs text-muted-foreground">
                                            Verification might take from 24 to 48 hours or so.
                                        </p>
                                        <Button
                                            onClick={handleVerify}
                                            disabled={verifying}
                                            size="sm"
                                            className="shrink-0"
                                        >
                                            {verifying ? "Verifying..." : "Verify Now"}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>
                ) : (
                    <Card>
                        <div className="p-6">
                            <p className="text-sm text-muted-foreground">Domain not found</p>
                        </div>
                    </Card>
                )}
            </div>

            {/* DNS Records */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold">DNS Records</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Current DNS configuration for {domainName}
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefresh}
                        disabled={loading}
                    >
                        {loading ? "Refreshing..." : "Refresh"}
                    </Button>
                </div>
                {loading ? (
                    <Card>
                        {[1, 2, 3, 4].map((i) => (
                            <div
                                key={i}
                                className={cn(
                                    "p-4",
                                    i !== 4 && "border-b"
                                )}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4 flex-1">
                                        <Skeleton className="h-6 w-16" />
                                        <div className="space-y-2 flex-1">
                                            <Skeleton className="h-4 w-24" />
                                            <Skeleton className="h-3 w-48" />
                                        </div>
                                    </div>
                                    <Skeleton className="h-4 w-12" />
                                </div>
                            </div>
                        ))}
                    </Card>
                ) : dnsRecords.length === 0 ? (
                    <Card>
                        <div className="p-8 text-center text-muted-foreground">
                            <p>No DNS records found</p>
                        </div>
                    </Card>
                ) : (
                    <Card>
                        {dnsRecords.map((record, index) => (
                            <div
                                key={record.id}
                                className={cn(
                                    "p-4 hover:bg-muted/50 transition-colors",
                                    index !== dnsRecords.length - 1 && "border-b"
                                )}
                            >
                                <div className="flex items-center gap-4 min-w-0">
                                    <Badge variant="secondary" className="shrink-0 w-16 justify-center">
                                        {record.type}
                                    </Badge>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium text-sm">{record.name}</p>
                                        <p className="text-xs text-muted-foreground font-mono break-all">
                                            {record.value}
                                        </p>
                                    </div>
                                    <span className="text-xs text-muted-foreground shrink-0">{record.ttl}s</span>
                                </div>
                            </div>
                        ))}
                    </Card>
                )}
            </div>

            {/* Nameservers */}
            <div className="space-y-4">
                <div>
                    <h2 className="text-lg font-semibold">Nameservers</h2>
                    {loading ? (
                        <Skeleton className="h-4 w-64 mt-1" />
                    ) : (
                        <p className="text-sm text-muted-foreground mt-1">
                            {isUsingNeupCloud
                                ? "Your domain is using Neup.Cloud nameservers"
                                : "Update your nameservers at your registrar to use Neup.Cloud"}
                        </p>
                    )}
                </div>
                {loading ? (
                    <Card>
                        {[1, 2, 3, 4].map((i) => (
                            <div
                                key={i}
                                className={cn(
                                    "p-4",
                                    i !== 4 && "border-b"
                                )}
                            >
                                <div className="flex items-center justify-between">
                                    <Skeleton className="h-4 w-48" />
                                    <Skeleton className="h-8 w-8" />
                                </div>
                            </div>
                        ))}
                    </Card>
                ) : (
                    <>
                        <Card>
                            {nameservers.map((ns, index) => (
                                <div
                                    key={ns}
                                    className={cn(
                                        "p-4 hover:bg-muted/50 transition-colors",
                                        index !== nameservers.length - 1 && "border-b"
                                    )}
                                >
                                    <code className="text-sm font-mono break-all">{ns}</code>
                                </div>
                            ))}
                        </Card>

                        {!isUsingNeupCloud && (
                            <div className="pt-2 space-y-3">
                                <p className="text-sm font-medium">Recommended Neup.Cloud nameservers:</p>
                                <Card>
                                    {['ns1.neup.cloud', 'ns2.neup.cloud', 'ns3.neup.cloud', 'ns4.neup.cloud'].map((ns, index) => (
                                        <div
                                            key={ns}
                                            className={cn(
                                                "p-4 bg-muted/30",
                                                index !== 3 && "border-b"
                                            )}
                                        >
                                            <div className="flex items-center justify-between">
                                                <code className="text-sm font-mono">{ns}</code>
                                                <CopyButton text={ns} />
                                            </div>
                                        </div>
                                    ))}
                                </Card>
                                <p className="text-xs text-muted-foreground">
                                    DNS changes can take up to 24-48 hours to propagate
                                </p>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Danger Zone */}
            <div className="space-y-4">
                <div>
                    <h2 className="text-lg font-semibold text-destructive">Danger Zone</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Irreversible actions for this domain
                    </p>
                </div>
                <Card className="border-destructive/50">
                    <div className="p-6">
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" className="w-full sm:w-auto" disabled={deleting}>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    {deleting ? "Deleting..." : "Delete Domain"}
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This action cannot be undone. This will permanently delete the domain{" "}
                                        <span className="font-semibold text-foreground">{domainName}</span> from your account.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                        Delete
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </Card>
            </div>
        </div>
    );
}
