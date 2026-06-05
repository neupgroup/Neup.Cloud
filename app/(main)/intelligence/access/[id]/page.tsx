import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FilePenLine } from 'lucide-react';

import { PageTitleBack } from '@/components/page-header';
import { getCurrentIntelligenceAccountId } from '@/core/ai/files/intelligence/account';
import {
  getAccessTokens,
  getIntelligenceAccessById,
  getIntelligenceModels,
  isAccessPublished,
  parseDetailsArray,
} from '@/core/ai/files/intelligence/store';
import AccessDetailClient from '@/app/(main)/intelligence/access/[id]/access-detail-client';

export const metadata: Metadata = {
  title: 'Intelligence Access Details, Neup.Cloud',
};

export default async function IntelligenceAccessDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const accountId = await getCurrentIntelligenceAccountId();
  const resolvedParams = await params;
  const accessId = resolvedParams.id;

  if (!accessId || typeof accessId !== 'string') {
    notFound();
  }

  const access = await getIntelligenceAccessById(accountId, accessId);

  if (!access) {
    notFound();
  }

  const [tokens, models] = await Promise.all([
    getAccessTokens(accountId),
    getIntelligenceModels(),
  ]);

  const detailsArray = parseDetailsArray(access.details);
  const published = isAccessPublished(access.details);

  return (
    <div className="grid gap-8">
      <PageTitleBack
        title={
          <span className="flex items-center gap-3">
            <FilePenLine className="h-8 w-8 text-primary" />
            Intelligence Access #{access.id}
          </span>
        }
        description={`Manage access record (Type: ${access.type}, Status: ${access.status})`}
        backHref="/intelligence/access"
      />

      <AccessDetailClient
        accountId={accountId}
        access={{
          id: access.id,
          keyHash: access.key_hash,
          type: access.type,
          status: access.status,
          maxTokens: access.max_tokens,
          tokenBalance: access.token_balance,
          details: detailsArray,
          published,
        }}
        tokens={tokens}
        models={models}
      />
    </div>
  );
}
