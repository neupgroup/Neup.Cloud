"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageTitleBack } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

function normalizeDomain(value: string): string {
  return value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
}

export default function WhoisDomainLookupPage() {
  const router = useRouter();
  const [domain, setDomain] = useState('');

  const goToDetails = (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = normalizeDomain(domain);
    if (!normalized) return;
    router.push(`/domain/whois/${encodeURIComponent(normalized)}`);
  };

  return (
    <div className="space-y-6">
      <PageTitleBack
        title="Detailed WHOIS"
        description="Search one domain and open full WHOIS details."
        backHref="/domains/bulk"
      />

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={goToDetails} className="space-y-3">
            <Input
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
              placeholder="example.com"
            />
            <Button type="submit">Open detailed WHOIS</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
