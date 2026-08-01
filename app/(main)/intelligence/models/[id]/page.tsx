import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FilePenLine } from 'lucide-react';

import { PageTitleBack } from '@/components/page-header';
import { getIntelligenceModelById } from '@/services/intelligence/store';
import ModelEditForm from '@/app/(main)/intelligence/models/[id]/model-edit-form';

export const metadata: Metadata = {
  title: 'Edit Intelligence Model, Neup.Cloud',
};

export default async function IntelligenceModelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const modelId = Number(resolvedParams.id);

  if (!Number.isFinite(modelId)) {
    notFound();
  }

  const model = await getIntelligenceModelById(modelId);

  if (!model) {
    notFound();
  }

  return (
    <div className="grid gap-8">
      <PageTitleBack
        title={
          <span className="flex items-center gap-3">
            <FilePenLine className="h-8 w-8 text-primary" />
            View And Edit Model
          </span>
        }
        description={`${model.title} (${model.provider}:${model.model})`}
        backHref="/intelligence/models"
      />

      <ModelEditForm
        modelId={model.id}
        initialValues={{
          title: model.title,
          provider: model.provider,
          model: model.model,
          description: model.description,
          currency: model.currency,
          inputRate: model.inputRate,
          outputRate: model.outputRate,
          inputCostPer1000Tokens: model.inputCostPer1000Tokens,
          outputCostPer1000Tokens: model.outputCostPer1000Tokens,
        }}
      />
    </div>
  );
}
