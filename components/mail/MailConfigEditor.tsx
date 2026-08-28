/*
::neup.documentation::mail-config-editor

Reusable mail configuration flow used by the account-level and server-level mail pages.

::private

Supports a configurable page header so different routes can reuse the same domain mail DNS verification workflow.

::private end
::end
*/

'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/component/ui/card';
import { Button } from '@/component/ui/button';
import { Label } from '@/component/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/component/ui/select';
import { Skeleton } from '@/component/ui/skeleton';
import { PageTitleBack } from '@/components/page-header';
import { getDomains } from '@/services/domains/domains-service';
import type { ManagedDomain } from '@/services/domains/types';
import { checkMailDns, checkMailDnsRecord } from '@/services/mail/mail-service';
import type { MailDnsCheckKey, MailDnsCheckResult } from '@/services/mail/mail-service';
import { CheckCircle2, ExternalLink, RefreshCw, XCircle } from 'lucide-react';

type MailConfigEditorProps = {
  backHref?: string;
  title?: string;
  description?: string;
};

export default function MailConfigEditor({
  backHref = '/server/webservices/nginx',
  title = 'Mail',
  description = 'Configure email for your domain in guided steps.',
}: MailConfigEditorProps) {
  const [domains, setDomains] = useState<ManagedDomain[]>([]);
  const [mailDnsCheck, setMailDnsCheck] = useState<MailDnsCheckResult | null>(null);
  const [isDomainsLoading, setIsDomainsLoading] = useState(true);
  const [isMailDnsChecking, setIsMailDnsChecking] = useState(false);
  const [selectedDomainId, setSelectedDomainId] = useState<string>('');
  const [mailDnsRefreshKey, setMailDnsRefreshKey] = useState(0);
  const [generatedGuideKeys, setGeneratedGuideKeys] = useState<string[]>([]);
  const [spfAllPolicy, setSpfAllPolicy] = useState('-all');
  const [checkingRecordKeys, setCheckingRecordKeys] = useState<MailDnsCheckKey[]>([]);

  useEffect(() => {
    const loadDomains = async () => {
      setIsDomainsLoading(true);
      try {
        const result = await getDomains();
        setDomains(result);
      } finally {
        setIsDomainsLoading(false);
      }
    };

    loadDomains();
  }, []);

  const selectedDomain = useMemo(
    () => domains.find((domain) => domain.id === selectedDomainId),
    [domains, selectedDomainId]
  );

  useEffect(() => {
    let isActive = true;

    const runMailDnsCheck = async () => {
      if (!selectedDomain) {
        setMailDnsCheck(null);
        return;
      }

      setIsMailDnsChecking(true);
      setMailDnsCheck(null);
      setGeneratedGuideKeys([]);
      setCheckingRecordKeys([]);

      try {
        const result = await checkMailDns(selectedDomain.name);
        if (isActive) {
          setMailDnsCheck(result);
        }
      } finally {
        if (isActive) {
          setIsMailDnsChecking(false);
        }
      }
    };

    runMailDnsCheck();

    return () => {
      isActive = false;
    };
  }, [selectedDomain, mailDnsRefreshKey]);

  const getGuideValue = (check: MailDnsCheckResult['checks'][number]) => {
    if (check.key !== 'spf' || !check.guide) {
      return check.guide?.value ?? '';
    }

    return check.guide.value.replace(/(?:[~?+\-]all)$/i, spfAllPolicy);
  };

  const handleCheckRecord = async (key: MailDnsCheckKey) => {
    if (!selectedDomain || checkingRecordKeys.includes(key)) {
      return;
    }

    setCheckingRecordKeys((keys) => [...keys, key]);

    try {
      const result = await checkMailDnsRecord(selectedDomain.name, key);
      const [updatedCheck] = result.checks;

      if (!updatedCheck) {
        return;
      }

      setGeneratedGuideKeys((keys) => keys.filter((guideKey) => guideKey !== key));
      setMailDnsCheck((current) => {
        if (!current) {
          return result;
        }

        const updatedChecks = current.checks.map((check) => (
          check.key === key ? updatedCheck : check
        ));

        return {
          domain: result.domain || current.domain,
          authoritativeNameservers: result.authoritativeNameservers.length > 0
            ? result.authoritativeNameservers
            : current.authoritativeNameservers,
          checks: updatedChecks,
          ok: updatedChecks.every((check) => check.ok),
        };
      });
    } finally {
      setCheckingRecordKeys((keys) => keys.filter((checkingKey) => checkingKey !== key));
    }
  };

  return (
    <div className="grid gap-6 pb-10">
      <PageTitleBack
        backHref={backHref}
        title={title}
        description={description}
      />

      <Card className="p-6 space-y-5">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Step 1</h2>
          <p className="text-sm text-muted-foreground">
            Choose the domain you want to configure the email for.
          </p>
        </div>

        {isDomainsLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : domains.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No domains found. Add or connect a domain first to continue.
          </p>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="mail-domain">Domain</Label>
            <Select value={selectedDomainId} onValueChange={setSelectedDomainId}>
              <SelectTrigger id="mail-domain">
                <SelectValue placeholder="Select a domain" />
              </SelectTrigger>
              <SelectContent>
                {domains.map((domain) => (
                  <SelectItem key={domain.id} value={domain.id}>
                    {domain.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {selectedDomain ? (
          <p className="text-sm text-muted-foreground">
            Selected domain: <span className="font-medium text-foreground">{selectedDomain.name}</span>
          </p>
        ) : null}

        {selectedDomain ? (
          <>
            <div className="space-y-1 pt-2">
              <h2 className="text-lg font-semibold">Step 2</h2>
              <p className="text-sm text-muted-foreground">
                Verify mail DNS records for Neup.Mail.
              </p>
            </div>

            {isMailDnsChecking ? (
              <div className="grid gap-2">
                <Skeleton className="h-5 w-64" />
                <Skeleton className="h-5 w-72" />
                <Skeleton className="h-5 w-56" />
              </div>
            ) : mailDnsCheck ? (
              <>
                {mailDnsCheck.authoritativeNameservers.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Queried authoritative nameservers: {mailDnsCheck.authoritativeNameservers.join(', ')}
                  </p>
                ) : null}

                <div className="grid gap-3">
                  {mailDnsCheck.checks.map((check) => (
                    <div
                      key={check.key}
                      className="grid gap-2 rounded-md border bg-muted/20 p-4 text-sm"
                    >
                      <div className="flex items-start gap-2">
                        {check.ok ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                        ) : (
                          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">{check.label}</p>
                          <p className="text-muted-foreground">{check.message}</p>
                        </div>
                      </div>

                      <div className="pl-6">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleCheckRecord(check.key)}
                          disabled={checkingRecordKeys.includes(check.key)}
                          className="inline-flex items-center gap-2"
                        >
                          <RefreshCw className={checkingRecordKeys.includes(check.key) ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                          {checkingRecordKeys.includes(check.key) ? 'Checking...' : `Check ${check.label}`}
                        </Button>
                      </div>

                      {check.records.length > 0 ? (
                        <div className="grid gap-1 pl-6 font-mono text-xs text-muted-foreground">
                          {check.records.map((record) => (
                            <p key={record} className="break-all">{record}</p>
                          ))}
                        </div>
                      ) : null}

                      {!check.ok && check.guide ? (
                        <div className="grid gap-3 pl-6">
                          {check.key === 'spf' ? (
                            <div className="grid gap-2">
                              <Label htmlFor="spf-all-policy">SPF policy</Label>
                              <Select value={spfAllPolicy} onValueChange={setSpfAllPolicy}>
                                <SelectTrigger id="spf-all-policy">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="-all">-all - Hard Fail: reject unauthorized senders</SelectItem>
                                  <SelectItem value="~all">~all - Soft Fail: accept but mark suspicious</SelectItem>
                                  <SelectItem value="?all">?all - Neutral: no SPF decision</SelectItem>
                                  <SelectItem value="+all">+all - Pass everything: never recommended</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          ) : null}

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setGeneratedGuideKeys((keys) => (
                                keys.includes(check.key)
                                  ? keys.filter((key) => key !== check.key)
                                  : [...keys, check.key]
                              ));
                            }}
                          >
                            Generate
                          </Button>

                          {generatedGuideKeys.includes(check.key) ? (
                            <div className="mt-3 grid gap-2 rounded-md border bg-background p-3">
                              <p className="text-muted-foreground">{check.guide.note}</p>
                              <div className="grid gap-1 font-mono text-xs">
                                <p><span className="text-muted-foreground">Type:</span> {check.guide.type}</p>
                                <p><span className="text-muted-foreground">Name:</span> {check.guide.name}</p>
                                <p className="break-all"><span className="text-muted-foreground">Value:</span> {getGuideValue(check)}</p>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>

                {mailDnsCheck.ok ? (
                  <div className="grid gap-3 rounded-md border border-green-600/30 bg-green-600/10 p-4">
                    <p className="text-sm font-medium text-green-700">
                      Mail DNS is configured correctly. Continue to Neup.Mail.
                    </p>
                    <div>
                      <Button asChild className="inline-flex items-center gap-2">
                        <a href="https://neupgroup.com/mail" target="_blank" rel="noreferrer">
                          Continue to Neup.Mail
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setMailDnsRefreshKey((key) => key + 1)}
                      className="inline-flex items-center gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Recheck DNS
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Mail DNS check could not be loaded.</p>
            )}

          </>
        ) : null}
      </Card>
    </div>
  );
}
