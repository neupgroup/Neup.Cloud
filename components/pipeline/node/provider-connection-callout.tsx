'use client';

import Link from 'next/link';
import { ExternalLink, PlugZap } from 'lucide-react';

import { useProviderConnection, type PipelineProviderKey } from '@/components/pipeline/provider-connections';
import { Badge } from '#/components/ui/badge';
import { Button } from '#/components/ui/button';

type PipelineProviderConnectionCalloutProps = {
  provider: PipelineProviderKey;
  href: string;
};

const providerLabels: Record<PipelineProviderKey, string> = {
  whatsapp: 'WhatsApp',
  google: 'Google',
  github: 'GitHub',
  linkedin: 'LinkedIn',
};

export function PipelineProviderConnectionCallout({
  provider,
  href,
}: PipelineProviderConnectionCalloutProps) {
  const { connection, isLoaded } = useProviderConnection(provider);
  const isConnected = connection?.status === 'connected';

  return (
    <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50/85 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white">
              <PlugZap className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-950">{providerLabels[provider]} connection</p>
              <p className="text-sm leading-6 text-slate-500">
                {isLoaded
                  ? isConnected
                    ? `Connected as ${connection?.connectionName || providerLabels[provider]}.`
                    : connection
                      ? 'Saved as a draft in this browser.'
                      : 'Not connected yet.'
                  : 'Checking saved connection...'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              className={
                isConnected
                  ? 'rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50'
                  : 'rounded-full border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50'
              }
            >
              {isConnected ? 'Connected' : connection ? 'Draft' : 'Setup needed'}
            </Badge>
            {connection?.updatedAt ? (
              <span className="text-xs text-slate-500">
                Updated {new Date(connection.updatedAt).toLocaleString()}
              </span>
            ) : null}
          </div>
        </div>

        <Button asChild variant="outline" className="rounded-2xl border-slate-200 bg-white">
          <Link href={href}>
            Open setup
            <ExternalLink className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
