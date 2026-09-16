'use client';

import { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { PageTitleBack } from '@/components/page-header';
import { useSelectedServerId, withSelectedServerQuery } from '@/hooks/use-selected-server';
import { CreateCertificateForm } from './create-certificate-form';

function NewCertificatePage() {
    const router = useRouter();
    const serverId = useSelectedServerId();
    const certificatesHref = withSelectedServerQuery('/server/webservices/certificates', serverId);
    const returnToCertificates = () => router.push(certificatesHref);

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20">
            <PageTitleBack
                title="Create SSL Certificate"
                description="Issue a certificate for your domain or verify a wildcard certificate."
                backHref={certificatesHref}
            />
            <CreateCertificateForm
                serverId={serverId}
                onSuccess={returnToCertificates}
            />
        </div>
    );
}

export default function Page() {
    return (
        <Suspense fallback={null}>
            <NewCertificatePage />
        </Suspense>
    );
}
