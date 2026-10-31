'use server';

import { Prisma } from '@neup/core/database/prisma';
import { revalidatePath } from 'next/cache';

import { getCurrentAccountId } from '@/services/account-profile';
import {
  createPipeline,
  createPipelineLog,
  deletePipelineLogsByPipelineId,
  getPipelineById,
  updatePipeline,
} from '@/services/pipelines/data';

// Require an authenticated account before reading or changing its saved pipelines.
async function getRequiredPipelineAccountId(): Promise<string> {
  const accountId = await getCurrentAccountId();
  if (!accountId) throw new Error('Authentication required.');
  return accountId;
}

export interface SavePipelineFlowInput {
  pipelineId?: string | null;
  title?: string | null;
  description?: string | null;
  flowJson: {
    nodes: unknown[];
    edges: unknown[];
  };
}

export interface SavePipelineFlowResult {
  id: string;
  title: string;
  description: string | null;
}

export interface CreatePipelineLogInput {
  pipelineId: string;
  logBy: string;
  details: string;
}

export interface ClearPipelineLogsInput {
  pipelineId: string;
}

export async function savePipelineFlowAction(
  input: SavePipelineFlowInput
): Promise<SavePipelineFlowResult> {
  const accountId = await getRequiredPipelineAccountId();
  const title = input.title?.trim() || 'Untitled Pipeline';
  const description = input.description?.trim() || null;
  const flowJson = {
    nodes: Array.isArray(input.flowJson?.nodes) ? input.flowJson.nodes : [],
    edges: Array.isArray(input.flowJson?.edges) ? input.flowJson.edges : [],
  } as Prisma.InputJsonValue;

  const flowNodeCount = Array.isArray(input.flowJson?.nodes) ? input.flowJson.nodes.length : 0;

  if (flowNodeCount === 0) {
    throw new Error('Add at least one node before saving the pipeline.');
  }

  const existingPipelineId = input.pipelineId?.trim() || null;

  if (existingPipelineId) {
    const existingPipeline = await getPipelineById(existingPipelineId, accountId);

    if (!existingPipeline) {
      throw new Error('The selected pipeline could not be found for this account.');
    }

    const updatedPipeline = await updatePipeline(existingPipelineId, {
      title,
      description,
      flowJson,
    });

    revalidatePath('/pipeline');
    revalidatePath('/pipeline/instance');
    revalidatePath(`/pipeline/editor?id=${updatedPipeline.id}`);

    return {
      id: updatedPipeline.id,
      title: updatedPipeline.title,
      description: updatedPipeline.description ?? null,
    };
  }

  const createdPipeline = await createPipeline({
    accountId,
    title,
    description,
    flowJson,
  });

  revalidatePath('/pipeline');
  revalidatePath('/pipeline/instance');
  revalidatePath(`/pipeline/editor?id=${createdPipeline.id}`);

  return {
    id: createdPipeline.id,
    title: createdPipeline.title,
    description: createdPipeline.description ?? null,
  };
}

export async function createPipelineLogAction(
  input: CreatePipelineLogInput
) {
  const accountId = await getRequiredPipelineAccountId();
  const pipelineId = input.pipelineId.trim();
  const details = input.details.trim();
  const logBy = input.logBy.trim() || 'system';

  if (!pipelineId) {
    throw new Error('Pipeline id is required for log creation.');
  }

  if (!details) {
    return null;
  }

  const pipeline = await getPipelineById(pipelineId, accountId);

  if (!pipeline) {
    throw new Error('The selected pipeline could not be found for this account.');
  }

  const createdLog = await createPipelineLog({
    pipelineId,
    logBy,
    details,
  });

  revalidatePath(`/pipeline/instance/${pipelineId}/logs`);
  revalidatePath('/pipeline/instance');

  return createdLog;
}

export async function clearPipelineLogsAction(
  input: ClearPipelineLogsInput
) {
  const accountId = await getRequiredPipelineAccountId();
  const pipelineId = input.pipelineId.trim();

  if (!pipelineId) {
    throw new Error('Pipeline id is required to clear logs.');
  }

  const pipeline = await getPipelineById(pipelineId, accountId);

  if (!pipeline) {
    throw new Error('The selected pipeline could not be found for this account.');
  }

  await deletePipelineLogsByPipelineId(pipelineId);

  revalidatePath(`/pipeline/instance/${pipelineId}/logs`);
  revalidatePath('/pipeline/instance');
}
