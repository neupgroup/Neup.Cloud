"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card';
import { Button } from '#/components/ui/button';
import { Input } from '#/components/ui/input';
import { useToast } from '#/core/hooks/useToast';
import { Loader2, ArrowLeft } from 'lucide-react';
import { addDomain } from '@/services/domains/domains-service';
import Link from 'next/link';
import { PageTitleBack } from '@/components/page-header';

export default function AddDomainPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [domainName, setDomainName] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!domainName) {
            toast({ variant: 'destructive', title: 'Error', description: 'Domain name cannot be empty.' });
            return;
        }
        setIsAdding(true);
        try {
            await addDomain(domainName);
            toast({ title: 'Success', description: `Domain "${domainName}" added. Please configure its nameservers.` });
            router.push('/domains');
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error adding domain', description: error.message });
        } finally {
            setIsAdding(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <PageTitleBack
                title="Connect Domain"
                backHref="/domains"
                className=""
            />

            <Card>
                <CardHeader>
                    <CardTitle className="font-headline">Connect an Existing Domain</CardTitle>
                    <CardDescription>Connect a domain you already own to manage it with Neup.Cloud.</CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label htmlFor="domain" className="text-sm font-medium">Domain Name</label>
                                <Input
                                    id="domain"
                                    value={domainName}
                                    onChange={(e) => setDomainName(e.target.value)}
                                    placeholder="your-domain.com"
                                    disabled={isAdding}
                                />
                            </div>
                            <Button type="submit" disabled={isAdding} className="w-full">
                                {isAdding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                {isAdding ? "Connecting..." : "Connect Domain"}
                            </Button>
                        </div>
                    </CardContent>
                </form>
            </Card>
        </div>
    );
}
