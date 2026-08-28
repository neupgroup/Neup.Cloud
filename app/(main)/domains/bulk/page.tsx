"use client";

import React, { useMemo, useState, useTransition } from 'react';
import { PageTitleBack } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card';
import { Button } from '#/components/ui/button';
import { Textarea } from '#/components/ui/textarea';
import { Badge } from '#/components/ui/badge';
import { Collapsible, CollapsibleContent } from '#/components/ui/collapsible';
import { Icon } from '#/components/ui/icon';
import { useToast } from '#/core/hooks/useToast';
import { ExternalLink } from 'lucide-react';
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
  const { toast } = useToast();
  const [csvInput, setCsvInput] = useState('');
  const [results, setResults] = useState<AvailabilityResult[]>([]);
  const [isChecking, startTransition] = useTransition();
  const [animateResults, setAnimateResults] = useState(false);
  const [lastCheckedDomains, setLastCheckedDomains] = useState<string[]>([]);
  const [checkingDomains, setCheckingDomains] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({});

  const parsedDomains = useMemo(() => extractDomainsFromCsv(csvInput), [csvInput]);
  const resultByDomain = useMemo(
    () => new Map(results.map((result) => [result.domain, result])),
    [results],
  );
  const domainsHaveChanged =
    parsedDomains.length !== lastCheckedDomains.length ||
    parsedDomains.some((domain) => !lastCheckedDomains.includes(domain));

  const runCheck = (requestedDomains?: string[]) => {
    const allDomains = extractDomainsFromCsv(csvInput);
    const domains = requestedDomains ?? allDomains;
    if (allDomains.length === 0) {
      setResults([]);
      setAnimateResults(false);
      setLastCheckedDomains([]);
      setCheckingDomains(new Set());
      setProgress({ completed: 0, total: 0 });
      return;
    }

    const domainsToCheck = domains.filter((domain) => !resultByDomain.has(domain));
    if (domainsToCheck.length === 0) {
      setResults((previous) => previous.filter((result) => allDomains.includes(result.domain)));
      setLastCheckedDomains((previous) => previous.filter((domain) => allDomains.includes(domain)));
      setAnimateResults(false);
      setCheckingDomains(new Set());
      setProgress({ completed: 0, total: 0 });
      return;
    }

    setCheckingDomains(new Set(domainsToCheck));
    startTransition(async () => {
      setResults((previous) => previous.filter((result) => allDomains.includes(result.domain)));
      setAnimateResults(false);
      setProgress({ completed: 0, total: domainsToCheck.length });
      if (!requestedDomains) setOpenCards({});

      const whoisToast = toast({
        name: 'domains-bulk-whois',
        convey: 'info',
        icon: <Icon type="animated" from="Search" size={24} />,
        title: `Searching ${domainsToCheck.length} Domains`,
        description: `0 Available for Purchase of ${domainsToCheck.length} domains`,
        dismissesOn: null,
      });

      let notFoundCount = 0;

      for (let index = 0; index < domainsToCheck.length; index += 1) {
        const domain = domainsToCheck[index];
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

        if (!result.whoisExists) notFoundCount += 1;

        whoisToast.update({
          title: `Searching ${domainsToCheck.length} Domains`,
          description: `${notFoundCount} Available for Purchase of ${domainsToCheck.length} domains`,
        });

        setResults((previous) => [...previous, result]);
        setProgress({ completed: index + 1, total: domainsToCheck.length });
      }

      whoisToast.update({
        icon: (
          <Icon
            type="animated"
            from="Search"
            to="Searched"
            position={0}
            size={24}
            onComplete={() => whoisToast.update({
              icon: <Icon type="animated" from="Search" to="Searched" position={2} size={24} />,
            })}
          />
        ),
        title: `Searched ${domainsToCheck.length} Domains`,
        description: `${notFoundCount} Available for Purchase of ${domainsToCheck.length} domains`,
        dismissesOn: 5,
      });
      setAnimateResults(true);
      setCheckingDomains(new Set());
      setLastCheckedDomains((previous) => requestedDomains
        ? Array.from(new Set([...previous, ...domainsToCheck])).filter((domain) => allDomains.includes(domain))
        : allDomains);
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
            onChange={(event) => {
              setCsvInput(event.target.value);
              setAnimateResults(false);
            }}
            placeholder="google.com, mysite.net\nbrandname.io"
            className="min-h-[180px]"
          />
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-muted-foreground">
            Detected domains: <span className="font-medium text-foreground">{parsedDomains.length}</span>
          </p>
          <Button onClick={() => runCheck()} disabled={isChecking || parsedDomains.length === 0 || !domainsHaveChanged}>
            {isChecking ? <Icon type="animated" from="Search" size={20} label={null} /> : null}
            {!isChecking && !domainsHaveChanged && lastCheckedDomains.length > 0 ? (
              <Icon type="animated" from="Search" to="Searched" position={2} size={20} label={null} />
            ) : null}
            Check WHOIS
          </Button>
        </div>

        {progress.total > 0 && (
          <p className="text-sm text-muted-foreground">
            Progress: <span className="font-medium text-foreground">{progress.completed}</span> / {progress.total}
          </p>
        )}
      </Card>

      {parsedDomains.length > 0 && (
        <div className="grid gap-0">
          {parsedDomains.map((domain, index) => {
            const result = resultByDomain.get(domain);
            const isSearching = checkingDomains.has(domain) && !result;
            const isFirstCard = index === 0;
            const isLastCard = index === parsedDomains.length - 1;

            return (
            <Card
              key={domain}
              className={`cursor-pointer rounded-none ${isFirstCard ? 'rounded-t-lg' : ''} ${isLastCard ? 'rounded-b-lg' : ''}`}
              onClick={() => {
                if (!result) return;
                setOpenCards((previous) => ({
                  ...previous,
                  [domain]: !previous[domain],
                }));
              }}
            >
              <Collapsible
                open={Boolean(result && openCards[domain])}
                onOpenChange={(open) =>
                  result && setOpenCards((previous) => ({
                    ...previous,
                    [domain]: open,
                  }))
                }
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <CardTitle className="flex items-center gap-2 text-xl">
                      {domain}
                      {isSearching ? (
                        <Icon type="animated" from="Search" size={24} label="Searching" />
                      ) : result ? (
                        <Icon
                          type="animated"
                          from="Search"
                          to={result.whoisExists ? 'CrossMark' : 'TickMark'}
                          position={checkingDomains.has(domain) || animateResults ? 0 : 2}
                          size={24}
                          label={result.whoisExists ? 'Unavailable' : 'Available'}
                        />
                      ) : null}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {result?.whoisExists ? (
                        <Badge className="bg-green-500/10 text-green-700 border-green-200 hover:bg-green-500/20 border">
                          WHOIS Found
                        </Badge>
                      ) : result ? (
                        <Badge variant="secondary">WHOIS Not Found</Badge>
                      ) : null}
                      {!result && (
                        <Button
                          type="outlined"
                          size="sm"
                          disabled={isChecking}
                          onClick={(event) => {
                            event.stopPropagation();
                            runCheck([domain]);
                          }}
                        >
                          {isSearching ? <Icon type="animated" from="Search" size={16} label={null} /> : null}
                          {isSearching ? 'Searching...' : 'Search'}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
                  <CardContent className="space-y-4">
                    {result ? (
                      <>
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
                          <p className="text-sm">Whois information does not exist.</p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {isSearching ? 'Searching WHOIS information...' : 'Start a WHOIS check to view details.'}
                      </p>
                    )}

                    {result && (
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button type="outlined" asChild>
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
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
