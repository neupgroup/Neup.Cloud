"use client";

import React, { useMemo, useState, useTransition } from 'react';
import { PageTitleBack } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { ChevronDown, ExternalLink, Loader2 } from 'lucide-react';
import Link from 'next/link';

type WhoisInfo = {
  domainName: string | null;
  whoisHandle: string | null;
  registrar: string | null;
  statuses: string[];
  createdAt: string | null;
  updatedAt: string | null;
  expiresAt: string | null;
  nameservers: string[];
};

type AvailabilityResult = {
  domain: string;
  whoisExists: boolean;
  reason: string;
  nameComUrl: string;
  whois?: WhoisInfo;
};

const DOMAIN_REGEX = /^(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/i;
const APP_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '/cloud';

function extractDomainsFromCsv(input: string): string[] {
  const tokens = input
    .split(/[\n,;\t\s]+/g)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .map((value) => value.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, ''));

  const unique = new Set<string>();
  for (const token of tokens) {
    if (DOMAIN_REGEX.test(token)) unique.add(token);
  }

  return [...unique];
}

function formatDate(value: string | null) {
  if (!value) return 'N/A';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

export default function DomainsBulkPage() {
  const [csvInput, setCsvInput] = useState('');
  const [results, setResults] = useState<AvailabilityResult[]>([]);
  const [isChecking, startTransition] = useTransition();
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({});

  const parsedDomains = useMemo(() => extractDomainsFromCsv(csvInput), [csvInput]);

  const runCheck = () => {
    const domains = extractDomainsFromCsv(csvInput);
    if (domains.length === 0) {
      setResults([]);
      setProgress({ completed: 0, total: 0 });
      return;
    }

    startTransition(async () => {
      setResults([]);
      setProgress({ completed: 0, total: domains.length });
      setOpenCards({});

      for (let index = 0; index < domains.length; index += 1) {
        const domain = domains[index];
        const defaultNameComUrl = `https://www.name.com/domain/search/${encodeURIComponent(domain)}`;

        let result: AvailabilityResult;
        try {
          const response = await fetch(`${APP_BASE_PATH}/bridge/api.v1/domain/whois/${encodeURIComponent(domain)}`, {
            cache: 'no-store',
          });
          const data = await response.json();

          result = {
            domain,
            whoisExists: Boolean(data.whoisExists),
            reason: data.reason || 'No response reason',
            nameComUrl: typeof data.nameComUrl === 'string' ? data.nameComUrl : defaultNameComUrl,
            whois: data.whois,
          };
        } catch {
          result = {
            domain,
            whoisExists: false,
            reason: 'WHOIS information does not exists.',
            nameComUrl: defaultNameComUrl,
          };
        }

        setResults((previous) => [...previous, result]);
        setProgress({ completed: index + 1, total: domains.length });
      }
    });
  };

  return (
    <div className="space-y-6">
      <PageTitleBack
        title="Bulk Domain Checker"
        description="Paste domains in CSV format and check live WHOIS information."
        backHref="/domains"
      />

      <Card className="p-4 space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Paste comma/newline-separated domains. Example: `google.com, mystartup.io, example.app`
          </p>
          <Textarea
            value={csvInput}
            onChange={(event) => setCsvInput(event.target.value)}
            placeholder="google.com, mysite.net\nbrandname.io"
            className="min-h-[180px]"
          />
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-muted-foreground">
            Detected domains: <span className="font-medium text-foreground">{parsedDomains.length}</span>
          </p>
          <Button onClick={runCheck} disabled={isChecking || parsedDomains.length === 0}>
            {isChecking ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Check WHOIS
          </Button>
        </div>

        {progress.total > 0 && (
          <p className="text-sm text-muted-foreground">
            Progress: <span className="font-medium text-foreground">{progress.completed}</span> / {progress.total}
          </p>
        )}
      </Card>

      {results.length > 0 && (
        <div className="grid gap-4">
          {results.map((result) => (
            <Card
              key={result.domain}
              className="cursor-pointer"
              onClick={() =>
                setOpenCards((previous) => ({
                  ...previous,
                  [result.domain]: !previous[result.domain],
                }))
              }
            >
              <Collapsible
                open={Boolean(openCards[result.domain])}
                onOpenChange={(open) =>
                  setOpenCards((previous) => ({
                    ...previous,
                    [result.domain]: open,
                  }))
                }
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <CardTitle className="text-xl">{result.domain}</CardTitle>
                    <div className="flex items-center gap-2">
                      {result.whoisExists ? (
                        <Badge className="bg-green-500/10 text-green-700 border-green-200 hover:bg-green-500/20 border">
                          WHOIS Found
                        </Badge>
                      ) : (
                        <Badge variant="secondary">WHOIS Not Found</Badge>
                      )}
                      <Button variant="ghost" size="sm">
                        Details
                        <ChevronDown
                          className={`ml-2 h-4 w-4 transition-transform duration-200 ${openCards[result.domain] ? 'rotate-180' : ''}`}
                        />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">{result.reason}</p>

                    {result.whoisExists && result.whois ? (
                      <div className="grid gap-2 text-sm">
                        <p><span className="text-muted-foreground">Registrar:</span> {result.whois.registrar ?? 'N/A'}</p>
                        <p><span className="text-muted-foreground">Handle:</span> {result.whois.whoisHandle ?? 'N/A'}</p>
                        <p><span className="text-muted-foreground">Created:</span> {formatDate(result.whois.createdAt)}</p>
                        <p><span className="text-muted-foreground">Updated:</span> {formatDate(result.whois.updatedAt)}</p>
                        <p><span className="text-muted-foreground">Expires:</span> {formatDate(result.whois.expiresAt)}</p>
                        <p>
                          <span className="text-muted-foreground">Statuses:</span>{' '}
                          {result.whois.statuses.length > 0 ? result.whois.statuses.join(', ') : 'N/A'}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Nameservers:</span>{' '}
                          {result.whois.nameservers.length > 0 ? result.whois.nameservers.join(', ') : 'N/A'}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm">Whois information does not exists.</p>
                    )}

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button variant="outline" asChild>
                          <Link
                            href={`/domain/whois/${encodeURIComponent(result.domain)}`}
                            onClick={(event) => event.stopPropagation()}
                          >
                            Detailed WHOIS
                          </Link>
                        </Button>
                        <Button
                          variant={result.whoisExists ? 'outline' : 'default'}
                          asChild
                        >
                          <a
                            href={result.nameComUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(event) => event.stopPropagation()}
                          >
                            Search via name.com
                            <ExternalLink className="ml-2 h-3 w-3" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
