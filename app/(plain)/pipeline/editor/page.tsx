import type { Metadata } from 'next';

import PipelineEditor from '@/components/pipeline/editor';
import { getCurrentAccountId } from '@/services/account-profile';
import { getPipelineById } from '@/services/pipelines/data';

export const metadata: Metadata = {
  title: 'Pipeline Editor | Neup.Cloud',
  description: 'Edit automations in the Neup.Cloud pipeline studio.',
};


export default async function PipelineEditorPage({
  searchParams,
}: {
  searchParams?: Promise<{ id?: string | string[] }>;
}) {
  const accountId = await getCurrentAccountId();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const pipelineId =
    typeof resolvedSearchParams.id === 'string'
      ? resolvedSearchParams.id
      : Array.isArray(resolvedSearchParams.id)
        ? resolvedSearchParams.id[0]
        : undefined;

  const pipeline = pipelineId ? await getPipelineById(pipelineId, accountId ?? undefined) : null;

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
    />
  );
}
