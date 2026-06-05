import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FilePenLine, Terminal } from 'lucide-react';

import { PageTitleBack } from '@/components/page-header';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getCurrentIntelligenceAccountId } from '@/core/ai/files/intelligence/account';
import {
  getAccessTokens,
  getIntelligenceAccessById,
  getIntelligenceModels,
} from '@/core/ai/files/intelligence/store';
import AccessEditForm from '@/app/(main)/intelligence/access/[id]/access-edit-form';

export const metadata: Metadata = {
  title: 'Edit Intelligence Access, Neup.Cloud',
};

export default async function IntelligenceAccessDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const accountId = await getCurrentIntelligenceAccountId();
  const resolvedParams = await params;
  const accessId = Number(resolvedParams.id);

  if (!Number.isFinite(accessId)) {
    notFound();
  }

  const [access, tokens, models] = await Promise.all([
    getIntelligenceAccessById(accountId, accessId),
    getAccessTokens(accountId),
    getIntelligenceModels(),
  ]);

  if (!access) {
    notFound();
  }

  const requestUrl = 'http://localhost:25683/bridge/api.v1/intelligence/getResponse';
  const accessType = access.type;

  return (
    <div className="grid gap-8">
      <PageTitleBack
        title={
          <span className="flex items-center gap-3">
            <FilePenLine className="h-8 w-8 text-primary" />
            Edit Intelligence Access
          </span>
        }
        description={`Editing access #${access.id} (Type: ${accessType}).`}
        backHref="/intelligence/access"
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-headline">
            <Terminal className="h-5 w-5 text-primary" />
            Example Curl Request
          </CardTitle>
          <CardDescription>
            Edit the request fields here, then run the request and inspect the response below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 text-sm text-muted-foreground">
            <div>
              <p className="font-medium text-foreground">Request URL</p>
              <p className="font-mono break-all">{requestUrl}</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Access Type</p>
              <p>{accessType}</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Expected Payload</p>
              <pre className="overflow-auto rounded-xl bg-muted p-3 text-xs text-foreground">
                {`{
  "accessId": "${access.key_hash.substring(0, 16)}...",
  "accessKey": "YOUR_ACCESS_KEY",
  "query": "Your query here",
  "context": "Optional context"
}`}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>

      <AccessEditForm
        accessId={access.id}
        tokens={tokens.map((token) => ({
          id: token.id,
          name: token.name,
        }))}
        models={models.map((model) => ({
          id: model.id,
          title: model.title,
          provider: model.provider,
          model: model.model,
        }))}
        initialValues={{
          accessId: access.id,
          keyHash: access.key_hash,
          type: access.type,
          availableTo: access.available_to,
          details: access.details,
          maxTokens: access.max_tokens,
          tokenBalance: access.token_balance,
          status: access.status,
        }}
      />
    </div>
  );
}
