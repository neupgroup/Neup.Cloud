"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { PageTitleBack } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Loader2 } from 'lucide-react';

type WhoisInfo = {
  domainName: string | null;
  whoisHandle?: string | null;
  registrar: string | null;
  whoisServer?: string | null;
  statuses: string[];
  createdAt: string | null;
  updatedAt: string | null;
  expiresAt: string | null;
  nameservers: string[];
  contacts?: {
    registrant: WhoisContact | null;
    admin: WhoisContact | null;
    tech: WhoisContact | null;
    billing: WhoisContact | null;
  };
  raw?: string;
};

type WhoisContact = {
  name: string | null;
  organization: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
};

type WhoisResponse = {
  domain: string;
  whoisExists: boolean;
  reason: string;
  nameComUrl: string;
  whois?: WhoisInfo;
};

const APP_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '/cloud';

function formatDate(value: string | null | undefined) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function ContactBlock({ title, contact }: { title: string; contact: WhoisContact | null | undefined }) {
  if (!contact) return null;

  return (
    <div className="rounded-md border p-3">
      <p className="text-sm font-medium mb-2">{title}</p>
      <div className="grid gap-1 text-sm">
        <p><span className="text-muted-foreground">Name:</span> {contact.name ?? 'N/A'}</p>
        <p><span className="text-muted-foreground">Organization:</span> {contact.organization ?? 'N/A'}</p>
        <p><span className="text-muted-foreground">Email:</span> {contact.email ?? 'N/A'}</p>
        <p><span className="text-muted-foreground">Phone:</span> {contact.phone ?? 'N/A'}</p>
        <p><span className="text-muted-foreground">City:</span> {contact.city ?? 'N/A'}</p>
        <p><span className="text-muted-foreground">State:</span> {contact.state ?? 'N/A'}</p>
        <p><span className="text-muted-foreground">Country:</span> {contact.country ?? 'N/A'}</p>
      </div>
    </div>
  );
}

export default function WhoisDomainDetailsPage() {
  const params = useParams<{ domain: string }>();
  const [data, setData] = useState<WhoisResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const domain = useMemo(() => decodeURIComponent(params.domain || ''), [params.domain]);

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${APP_BASE_PATH}/bridge/api.v1/domain/whois/${encodeURIComponent(domain)}`, {
          cache: 'no-store',
        });
        const payload = (await response.json()) as WhoisResponse;
        if (isMounted) setData(payload);
      } catch {
        if (isMounted) {
          setData({
            domain,
            whoisExists: false,
            reason: 'WHOIS lookup failed.',
            nameComUrl: `https://www.name.com/domain/search/${encodeURIComponent(domain)}`,
          });
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    if (domain) {
      run();
    } else {
      setIsLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [domain]);

  return (
    <div className="space-y-6">
      <PageTitleBack
        title={`WHOIS: ${domain || 'Domain'}`}
        description="Detailed WHOIS information for this domain."
        backHref="/domain/whois/domain"
      />

      {isLoading ? (
        <Card>
          <CardContent className="pt-6 flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Fetching WHOIS...
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-xl">{data?.domain || domain}</CardTitle>
              {data?.whoisExists ? (
                <Badge className="bg-green-500/10 text-green-700 border-green-200 hover:bg-green-500/20 border">
                  WHOIS Found
                </Badge>
              ) : (
                <Badge variant="secondary">WHOIS Not Found</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{data?.reason || 'No response.'}</p>

            {data?.whoisExists && data.whois ? (
              <>
                <div className="grid gap-2 text-sm">
                  <p><span className="text-muted-foreground">Domain Name:</span> {data.whois.domainName ?? 'N/A'}</p>
                  <p><span className="text-muted-foreground">Registrar:</span> {data.whois.registrar ?? 'N/A'}</p>
                  <p><span className="text-muted-foreground">WHOIS Server:</span> {data.whois.whoisServer ?? 'N/A'}</p>
                  <p><span className="text-muted-foreground">Created:</span> {formatDate(data.whois.createdAt)}</p>
                  <p><span className="text-muted-foreground">Updated:</span> {formatDate(data.whois.updatedAt)}</p>
                  <p><span className="text-muted-foreground">Expires:</span> {formatDate(data.whois.expiresAt)}</p>
                  <p>
                    <span className="text-muted-foreground">Statuses:</span>{' '}
                    {data.whois.statuses?.length ? data.whois.statuses.join(', ') : 'N/A'}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Nameservers:</span>{' '}
                    {data.whois.nameservers?.length ? data.whois.nameservers.join(', ') : 'N/A'}
                  </p>
                </div>

                {(data.whois.contacts?.registrant ||
                  data.whois.contacts?.admin ||
                  data.whois.contacts?.tech ||
                  data.whois.contacts?.billing) ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Contact Information</p>
                    <div className="grid gap-2">
                      <ContactBlock title="Registrant Contact" contact={data.whois.contacts?.registrant} />
                      <ContactBlock title="Admin Contact" contact={data.whois.contacts?.admin} />
                      <ContactBlock title="Technical Contact" contact={data.whois.contacts?.tech} />
                      <ContactBlock title="Billing Contact" contact={data.whois.contacts?.billing} />
                    </div>
                  </div>
                ) : null}

                {data.whois.raw ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Raw WHOIS</p>
                    <pre className="rounded-md border bg-muted p-3 text-xs overflow-auto whitespace-pre-wrap">{data.whois.raw}</pre>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-sm">Whois information does not exists.</p>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <Button variant={data?.whoisExists ? 'outline' : 'default'} asChild>
                <a href={data?.nameComUrl || `https://www.name.com/domain/search/${encodeURIComponent(domain)}`} target="_blank" rel="noopener noreferrer">
                  Search via name.com
                  <ExternalLink className="ml-2 h-3 w-3" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
