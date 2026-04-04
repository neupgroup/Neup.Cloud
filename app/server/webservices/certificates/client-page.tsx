
'use client';

import { PageTitleBack } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { AlertCircle, Calendar, CheckCircle2, FileKey, RefreshCw, Shield, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getCertificates } from './actions';
import { CreateCertificateDialog } from './create-dialog';
import Link from 'next/link';

interface Certificate {
    fileName: string;
    commonName: string;
    notBefore: string;
    notAfter: string;
    issuer: string;
    validUntil: string | null;
}

export default function CertificatesPage() {
    const { toast } = useToast();
    const [certificates, setCertificates] = useState<Certificate[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchCertificates = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getCertificates();
            setCertificates(data);
        } catch (err: any) {
            setError(err.message || "Failed to load certificates");
            toast({
                variant: "destructive",
                title: "Error",
                description: err.message
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCertificates();
    }, []);

    const getStatus = (validUntil: string | null) => {
        if (!validUntil) return { label: 'Unknown', color: 'text-gray-500', icon: AlertCircle };

        const date = new Date(validUntil);
        const now = new Date();
        const daysLeft = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (daysLeft < 0) return { label: 'Expired', color: 'text-red-500', icon: XCircle };
        if (daysLeft < 30) return { label: `Expiring in ${daysLeft} days`, color: 'text-amber-500', icon: AlertCircle };
        return { label: 'Valid', color: 'text-green-500', icon: CheckCircle2 };
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto pb-20">
            <PageTitleBack
                title="SSL Certificates"
                description="Manage SSL certificates installed on your Nginx server."
                backHref="/server/webservices"
            >
                <div className="flex gap-2">
                    <CreateCertificateDialog onSuccess={fetchCertificates} serverId={null} />
                    <Button variant="outline" onClick={fetchCertificates} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </PageTitleBack>

            {loading ? (
                <div className="grid gap-4 md:grid-cols-2">
                    {[1, 2, 3].map(i => (
                        <Skeleton key={i} className="h-40 rounded-xl" />
                    ))}
                </div>
            ) : error ? (
                <Card className="p-8 flex flex-col items-center justify-center text-center text-destructive border-dashed">
                    <AlertCircle className="h-10 w-10 mb-4 opacity-50" />
                    <h3 className="font-semibold text-lg mb-2">Failed to load certificates</h3>
                    <p className="text-sm opacity-80">{error}</p>
                </Card>
            ) : certificates.length === 0 ? (
                <Card className="p-16 flex flex-col items-center justify-center text-center text-muted-foreground border-dashed bg-muted/5">
                    <Shield className="h-12 w-12 mb-6 opacity-20" />
                    <h3 className="font-semibold text-lg text-foreground mb-2">No Certificates Found</h3>
                    <p className="text-sm max-w-md mx-auto mb-6">
                        No SSL certificates were found in /etc/nginx/ssl. Certificates generated via the Nginx Manager will appear here.
                    </p>
                    <Button asChild>
                        <a href="/server/webservices/nginx">Go to Nginx Manager</a>
                    </Button>
                </Card>
            ) : (
                <div className="grid gap-6 md:grid-cols-2">
                    {certificates.map((cert) => {
                        const status = getStatus(cert.validUntil);
                        const StatusIcon = status.icon;

                        return (
                            <Link href={`/server/webservices/certificates/${encodeURIComponent(cert.fileName)}`} key={cert.fileName}>
                                <Card className="overflow-hidden hover:border-primary/50 transition-colors cursor-pointer group">
                                    <div className="p-6 space-y-4">
                                        <div className="flex items-start justify-between">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <FileKey className="h-5 w-5 text-primary group-hover:text-amber-500 transition-colors" />
                                                    <h3 className="font-semibold text-lg break-all group-hover:text-primary transition-colors">{cert.commonName}</h3>
                                                </div>
                                                <p className="text-xs text-muted-foreground font-mono">{cert.fileName}</p>
                                            </div>
                                            <div className={`flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-full bg-muted ${status.color}`}>
                                                <StatusIcon className="h-3.5 w-3.5" />
                                                {status.label}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 text-sm mt-4 pt-4 border-t">
                                            <div>
                                                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Issued By</p>
                                                <p className="truncate" title={cert.issuer}>{cert.issuer.split('CN=')[1] || cert.issuer}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Expires</p>
                                                <div className="flex items-center gap-1.5">
                                                    <Calendar className="h-3.5 w-3.5 opacity-70" />
                                                    <span>{cert.validUntil ? new Date(cert.validUntil).toLocaleDateString() : 'N/A'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
