import type { Metadata } from 'next';

import PipelineEditor from '@/components/pipeline/editor';
import { getCurrentIntelligenceAccountId } from '@/services/intelligence/account';
import {
  getAccessTokens,
  getIntelligenceAccesses,
  getIntelligenceModels,
} from '@/services/intelligence/store';
import { getPipelineById } from '@/services/pipelines/data';

export const metadata: Metadata = {
  title: 'Pipeline Editor | Neup.Cloud',
  description: 'Edit automations in the Neup.Cloud pipeline studio.',
};

import { findMatchingModelId } from '@/services/core/findMatchingModelId';

export default async function PipelineEditorPage({
  searchParams,
}: {
  searchParams?: Promise<{ id?: string | string[] }>;
}) {
  const accountId = await getCurrentIntelligenceAccountId();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const pipelineId =
    typeof resolvedSearchParams.id === 'string'
      ? resolvedSearchParams.id
      : Array.isArray(resolvedSearchParams.id)
        ? resolvedSearchParams.id[0]
        : undefined;

  const [models, prompts, tokens] = await Promise.all([
    getIntelligenceModels(),
    getIntelligenceAccesses(accountId),
    getAccessTokens(accountId),
  ]);
  const pipeline = pipelineId ? await getPipelineById(pipelineId, accountId) : null;

  return (
    <PipelineEditor
      initialPipeline={
        pipeline
          ? {
              id: pipeline.id,
              title: pipeline.title,
              description: pipeline.description ?? null,
              flowJson: pipeline.flowJson,
            }
          : null
      }
      intelligenceModels={models.map((model) => ({
        id: model.id,
        title: model.title,
        provider: model.provider,
        model: model.model,
      }))}
      intelligencePrompts={prompts.map((prompt) => ({
        id: prompt.id,
        promptId: prompt.prompt_id,
        primaryModelId:
          prompt.primaryModelConfig?.id ||
          findMatchingModelId(models, prompt.primaryModel),
        fallbackModelId:
          prompt.fallbackModelConfig?.id ||
          findMatchingModelId(models, prompt.fallbackModel),
        primaryAccessKey: prompt.primaryAccessKey,
        fallbackAccessKey: prompt.fallbackAccessKey,
        maxTokens: prompt.maxTokens,
        guider: prompt.defPrompt,
      }))}
      intelligenceTokens={tokens.map((token) => ({
        id: token.id,
        name: token.name,
      }))}
    />
  );
}
