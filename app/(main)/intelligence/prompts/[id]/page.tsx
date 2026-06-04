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
import PromptTestPanel from './prompt-test-panel';

export const metadata: Metadata = {
  title: 'Edit Intelligence Prompt, Neup.Cloud',
};

function findMatchingModelId(
  availableModels: Array<{ id: number; provider: string; model: string }>,
  currentValue: string | null
): number | null {
  if (!currentValue) {
    return null;
  }

  const normalized = currentValue.trim().toLowerCase();
  const match = availableModels.find((model) => {
    const identifier = `${model.provider}:${model.model}`.toLowerCase();
    return identifier === normalized || model.model.toLowerCase() === normalized;
  });

  return match?.id ?? null;
}

export default async function IntelligencePromptDetailPage({
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

  const initialPrimaryModelId =
    access.primaryModelConfig?.id ||
    findMatchingModelId(models, access.primaryModel);
  const initialFallbackModelId =
    access.fallbackModelConfig?.id ||
    findMatchingModelId(models, access.fallbackModel);
  const suggestedModel =
    access.primaryModel ||
    (access.primaryModelConfig ? `${access.primaryModelConfig.provider}:${access.primaryModelConfig.model}` : '');
  const modelOptions = [
    access.primaryModelConfig
      ? {
          label: `Primary: ${access.primaryModelConfig.provider}:${access.primaryModelConfig.model}`,
          value: access.primaryModelConfig.model,
        }
      : null,
    access.fallbackModelConfig
      ? {
          label: `Fallback: ${access.fallbackModelConfig.provider}:${access.fallbackModelConfig.model}`,
          value: access.fallbackModelConfig.model,
        }
      : null,
    access.primaryModel
      ? {
          label: `Primary saved value: ${access.primaryModel}`,
          value: access.primaryModel,
        }
      : null,
    access.fallbackModel
      ? {
          label: `Fallback saved value: ${access.fallbackModel}`,
          value: access.fallbackModel,
        }
      : null,
  ].filter((option): option is { label: string; value: string } => Boolean(option));
  const uniqueModelOptions = modelOptions.filter(
    (option, index, all) => index === all.findIndex((candidate) => candidate.value === option.value)
  );
  const requestUrl = new URL('http://localhost:25683/bridge/api.v1/intelligence/getResponse');

  if (access.primaryModel) {
    requestUrl.searchParams.set('model', access.primaryModel);
  }

  const requestBody = JSON.stringify(
    {
      context: '',
      query: 'who are you?',
    },
    null,
    2
  );

  const exampleCurl = [
    `curl "${requestUrl.toString()}"`,
    '  -X POST',
    '  -H "Content-Type: application/json"',
    `  -H "userid: ${access.account_id}"`,
    `  -H "accessid: ${access.prompt_id}"`,
    '  -H "tokenKey: xxxxxxx"',
    '  -H "authcode: xxxxxxx"',
    `  -d '${requestBody}'`,
  ].join(' \\\n');

  return (
    <div className="grid gap-8">
      <PageTitleBack
        title={
          <span className="flex items-center gap-3">
            <FilePenLine className="h-8 w-8 text-primary" />
            Edit Intelligence Prompt
          </span>
        }
        description={`Editing prompt #${access.id} with access ID ${access.prompt_id}.`}
        backHref="/intelligence/prompts"
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-headline">
            <Terminal className="h-5 w-5 text-primary" />
            Example Curl Request
          </CardTitle>
          <CardDescription>
            This example uses the saved database values for this prompt. Replace the masked header values with your real secrets.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-xl border border-border/70 bg-muted/30 p-4 text-sm whitespace-pre-wrap">
            {exampleCurl}
          </pre>
        </CardContent>
      </Card>

      <PromptTestPanel
        accountId={access.account_id}
        accessIdentifier={access.prompt_id}
        tokenKey={access.token_hash}
        modelOptions={uniqueModelOptions}
        suggestedModel={suggestedModel}
      />

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
          accessIdentifier: access.prompt_id,
          balance: access.balance,
          currency: access.primaryModelConfig?.currency || access.fallbackModelConfig?.currency || 'USD',
          primaryModelId: initialPrimaryModelId,
          fallbackModelId: initialFallbackModelId,
          primaryAccessKey: access.primaryAccessKey,
          fallbackAccessKey: access.fallbackAccessKey,
          maxTokens: access.maxTokens,
          guider: access.defPrompt,
          tokenHash: access.token_hash,
        }}
      />
    </div>
  );
}
