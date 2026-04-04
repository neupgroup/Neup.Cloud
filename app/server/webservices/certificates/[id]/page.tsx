
'use client';

import { PageTitleBack } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Calendar, CheckCircle2, Copy, FileText, Globe, Key, Shield, ShieldCheck, Trash2, XCircle } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { deleteCertificate, getCertificate } from '../actions';

interface CertificateDetails {
    fileName: string;
    commonName: string;
    subject: string;
    issuer: string;
    notBefore: string;
    notAfter: string;
    fingerprint: string;
    serial: string;
    validUntil: string | null;
    sans: string[];
    fullText: string;
}

export default function CertificateDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const id = decodeURIComponent(params.id as string);
    const { toast } = useToast();

    const [cert, setCert] = useState<CertificateDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                const data = await getCertificate(id);
                if (!data) {
                    setError('Certificate not found');
                } else {
                    setCert(data);
                }
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [id]);

    const handleDelete = async () => {
        if (!cert) return;

        if (!confirm(`Are you sure you want to delete the certificate for ${cert.commonName}? This action cannot be undone and will prevent Nginx from starting if it references this certificate.`)) {
            return;
        }

        setDeleting(true);
        try {
            await deleteCertificate(cert.fileName);
            toast({ title: 'Certificate deleted successfully' });
            router.push('/server/webservices/certificates');
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Error deleting certificate', description: err.message });
        } finally {
            setDeleting(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: "Copied to clipboard" });
    };

    const getStatus = (validUntil: string | null) => {
        if (!validUntil) return { label: 'Unknown', color: 'bg-gray-500', icon: AlertCircle };

        const date = new Date(validUntil);
        const now = new Date();
        const daysLeft = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (daysLeft < 0) return { label: 'Expired', color: 'bg-destructive', icon: XCircle };
        if (daysLeft < 30) return { label: `Expiring in ${daysLeft} days`, color: 'bg-amber-500', icon: AlertCircle };
        return { label: 'Valid', color: 'bg-green-600', icon: CheckCircle2 };
    };

    if (loading) {
        return (
            <div className="space-y-6 max-w-5xl mx-auto pb-20">
                <Skeleton className="h-10 w-1/3" />
                <div className="grid gap-6 md:grid-cols-2">
                    <Skeleton className="h-40" />
                    <Skeleton className="h-40" />
                </div>
                <Skeleton className="h-96" />
            </div>
        );
    }

    if (error || !cert) {
        return (
            <div className="max-w-5xl mx-auto py-12">
                <Card className="border-destructive/20 bg-destructive/5 text-center p-8">
                    <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4 opacity-50" />
                    <h2 className="text-xl font-bold text-destructive mb-2">Error Loading Certificate</h2>
                    <p className="text-muted-foreground">{error || 'Certificate not found.'}</p>
                    <Button variant="outline" className="mt-6" onClick={() => window.history.back()}>Go Back</Button>
                </Card>
            </div>
        );
    }

    const status = getStatus(cert.validUntil);
    const StatusIcon = status.icon;

    return (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto pb-20">
            <PageTitleBack
                title={cert.commonName}
                description={`Certificate details for ${cert.fileName}`}
                backHref="/server/webservices/certificates"
            >
                <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-white text-sm font-semibold ${status.color}`}>
                        <StatusIcon className="h-4 w-4" />
                        {status.label}
                    </div>
                    <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        {deleting ? 'Deleting...' : 'Delete'}
                    </Button>
                </div>
            </PageTitleBack>

            <div className="grid gap-6 md:grid-cols-2">
                {/* General Info */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Shield className="h-4 w-4 text-primary" /> Certificate Information
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-1">
                            <p className="text-xs font-semibold text-muted-foreground uppercase">Common Name (CN)</p>
                            <div className="flex items-center gap-2">
                                <p className="text-sm font-mono bg-muted/50 px-2 py-1 rounded">{cert.commonName}</p>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(cert.commonName)}>
                                    <Copy className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs font-semibold text-muted-foreground uppercase">Issued By</p>
                            <p className="text-sm break-all">{cert.issuer}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs font-semibold text-muted-foreground uppercase">Serial Number</p>
                            <p className="text-xs font-mono break-all">{cert.serial}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs font-semibold text-muted-foreground uppercase">SHA-1 Fingerprint</p>
                            <p className="text-xs font-mono break-all">{cert.fingerprint}</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Validity & DNS */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Globe className="h-4 w-4 text-primary" /> Validity & Domains
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <p className="text-xs font-semibold text-muted-foreground uppercase">Issued On</p>
                                <div className="flex items-center gap-2 text-sm">
                                    <Calendar className="h-3 w-3 text-muted-foreground" />
                                    {cert.notBefore ? new Date(cert.notBefore).toLocaleDateString() : 'N/A'}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-semibold text-muted-foreground uppercase">Expires On</p>
                                <div className="flex items-center gap-2 text-sm">
                                    <Calendar className="h-3 w-3 text-muted-foreground" />
                                    {cert.validUntil ? new Date(cert.validUntil).toLocaleDateString() : 'N/A'}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2 pt-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase">Subject Alternative Names (SANs)</p>
                            <div className="flex flex-wrap gap-2">
                                {(cert.sans.length > 0 ? cert.sans : [cert.commonName]).map((san, i) => (
                                    <Badge key={i} variant="secondary" className="font-mono text-xs">
                                        {san}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Raw Output */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <FileText className="h-4 w-4 text-primary" /> Detailed Output
                    </CardTitle>
                    <CardDescription>Raw output from OpenSSL</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="bg-zinc-950 text-zinc-50 p-4 rounded-lg font-mono text-xs overflow-x-auto whitespace-pre">
                        {cert.fullText}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
