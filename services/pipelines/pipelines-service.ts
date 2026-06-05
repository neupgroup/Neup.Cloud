'use server';

import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';

import { getCurrentIntelligenceAccountId } from '@/core/ai/files/intelligence/account';
import { ensureIntelligenceTables, getIntelligenceDbPool } from '@/core/ai/files/intelligence/db';
import { invokeModel } from '@/core/ai/files/intelligence/model-client';
import {
  createIntelligenceAccessRecord,
  generateAccessIdentifier,
  generateAccessToken,
  getAccessTokens,
  getIntelligenceAccesses,
  getIntelligenceModels,
  hashAccessToken,
  buildModelString,
  buildDetailsObject,
  parseDetailsObject,
  parseModelString,
  type IntelligenceAccessRecord,
  type StoredModelConfig,
} from '@/core/ai/files/intelligence/store';
import {
  createPipeline,
  createPipelineLog,
  deletePipelineLogsByPipelineId,
  getPipelineById,
  updatePipeline,
} from '@/services/pipelines/data';

export interface PipelineAiAgentExecutionInput {
  promptMode: 'existing' | 'new';
  promptId: string | null;
  primaryModelId: number | null;
  fallbackModelId: number | null;
  primaryAccessKey: number | null;
  fallbackAccessKey: number | null;
  maxTokens: number | null;
  masterPrompt: string | null;
  prompt: string;
  context: string | null;
}

export interface PipelineAiAgentExecutionResult {
  promptId: string;
  responseText: string;
  renderedPrompt: string;
  usedModel: string;
  remainingBalance: number;
  createdPrompt: boolean;
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

interface BuiltPrompt {
  renderedPrompt: string;
  masterPrompt: string;
  context: string;
  query: string;
}

function normalizeText(value: string | null | undefined): string {
  return (value || '').trim();
}

function findMatchingModelId(
  availableModels: Array<{ id: number; provider: string; model: string }>,
  currentValue: string | null
): number | null {
  const normalized = normalizeText(currentValue).toLowerCase();

  if (!normalized) {
    return null;
  }

  const match = availableModels.find((model) => {
    const identifier = `${model.provider}:${model.model}`.toLowerCase();
    return identifier === normalized || model.model.toLowerCase() === normalized;
  });

  return match?.id ?? null;
}

function stringifyContext(value: string | null): string {
  if (!value || !value.trim()) {
    return '';
  }

  try {
    return JSON.stringify(JSON.parse(value));
  } catch {
    return value.trim();
  }
}

function buildPrompt(masterPrompt: string | null, prompt: string, context: string): BuiltPrompt {
  const resolvedMasterPrompt = normalizeText(masterPrompt);
  const resolvedPrompt = normalizeText(prompt);
  const resolvedContext = normalizeText(context);
  const sections: string[] = [];

  if (resolvedPrompt) {
    sections.push(`Query:\n${resolvedPrompt}`);
  }

  if (resolvedMasterPrompt) {
    sections.push(`Guider:\n${resolvedMasterPrompt}`);
  }

  if (resolvedContext) {
    sections.push(`Context:\n${resolvedContext}`);
  }

  return {
    renderedPrompt: sections.join('\n\n').trim(),
    masterPrompt: resolvedMasterPrompt,
    query: resolvedPrompt,
    context: resolvedContext,
  };
}

function buildStoredContext(
  rawContext: string,
  metadata: Record<string, unknown> & {
    guider?: string;
    query?: string;
  }
): string {
  let requestContext: unknown = rawContext;

  if (rawContext.trim()) {
    try {
      requestContext = JSON.parse(rawContext);
    } catch {
      requestContext = rawContext;
    }
  }

  return JSON.stringify({
    context: requestContext,
    ...metadata,
  });
}

function readPriceNumber(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = Number(source[key]);
    if (Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function estimateModelCost(
  modelConfig: {
    currency: string;
    inputCostPer1000Tokens: number;
    outputCostPer1000Tokens: number;
    price: Record<string, unknown>;
  },
  inputTokens: number,
  outputTokens: number,
  usageTokens: number
): { cost: number | null; currency: string | null } {
  if (modelConfig.inputCostPer1000Tokens > 0 || modelConfig.outputCostPer1000Tokens > 0) {
    return {
      cost: Number(
        (
          ((inputTokens / 1000) * modelConfig.inputCostPer1000Tokens) +
          ((outputTokens / 1000) * modelConfig.outputCostPer1000Tokens)
        ).toFixed(8)
      ),
      currency: modelConfig.currency || 'USD',
    };
  }

  const price = modelConfig.price;
  const inputPer1000 = readPriceNumber(price, ['inputCostPer1000Tokens', 'inputPer1000', 'input_per_1000']);
  const outputPer1000 = readPriceNumber(price, ['outputCostPer1000Tokens', 'outputPer1000', 'output_per_1000']);
  const per1000 = readPriceNumber(price, ['costPer1000Tokens', 'per1000', 'per_1000']);
  const inputPer1M = readPriceNumber(price, ['inputPer1M', 'input_per_1m', 'input']);
  const outputPer1M = readPriceNumber(price, ['outputPer1M', 'output_per_1m', 'output']);
  const flatPer1M = readPriceNumber(price, ['per1M', 'per_1m', 'totalPer1M']);
  const inputPerToken = readPriceNumber(price, ['inputPerToken', 'input_per_token']);
  const outputPerToken = readPriceNumber(price, ['outputPerToken', 'output_per_token']);
  const flatPerToken = readPriceNumber(price, ['perToken', 'per_token']);
  const currency =
    typeof price.currency === 'string' && price.currency.trim()
      ? price.currency.trim().toUpperCase()
      : modelConfig.currency || 'USD';

  if (inputPer1000 !== null || outputPer1000 !== null) {
    return {
      cost: Number(
        (
          ((inputTokens / 1000) * (inputPer1000 ?? per1000 ?? 0)) +
          ((outputTokens / 1000) * (outputPer1000 ?? per1000 ?? 0))
        ).toFixed(8)
      ),
      currency,
    };
  }

  if (per1000 !== null) {
    return {
      cost: Number(((usageTokens / 1000) * per1000).toFixed(8)),
      currency,
    };
  }

  if (inputPerToken !== null || outputPerToken !== null) {
    return {
      cost: Number(
        (
          (inputTokens * (inputPerToken ?? flatPerToken ?? 0)) +
          (outputTokens * (outputPerToken ?? flatPerToken ?? 0))
        ).toFixed(8)
      ),
      currency,
    };
  }

  if (inputPer1M !== null || outputPer1M !== null) {
    return {
      cost: Number(
        (
          ((inputTokens / 1_000_000) * (inputPer1M ?? flatPer1M ?? 0)) +
          ((outputTokens / 1_000_000) * (outputPer1M ?? flatPer1M ?? 0))
        ).toFixed(8)
      ),
      currency,
    };
  }

  if (flatPer1M !== null) {
    return {
      cost: Number(((usageTokens / 1_000_000) * flatPer1M).toFixed(8)),
      currency,
    };
  }

  if (flatPerToken !== null) {
    return {
      cost: Number((usageTokens * flatPerToken).toFixed(8)),
      currency,
    };
  }

  return {
    cost: null,
    currency: currency || null,
  };
}

async function upsertPipelinePromptRecord(
  input: PipelineAiAgentExecutionInput,
  accountId: string
): Promise<{ access: IntelligenceAccessRecord; createdPrompt: boolean }> {
  const [models, accesses] = await Promise.all([
    getIntelligenceModels(),
    getIntelligenceAccesses(accountId),
  ]);

  const trimmedPromptId = normalizeText(input.promptId);
  const existingAccess =
    trimmedPromptId
      ? accesses.find((access) => access.prompt_id.toLowerCase() === trimmedPromptId.toLowerCase()) ?? null
      : null;

  const primaryModelId =
    input.primaryModelId ??
    (existingAccess?.primaryModelConfig?.id || findMatchingModelId(models, existingAccess?.primaryModel ?? null));
  const fallbackModelId =
    input.fallbackModelId ??
    (existingAccess?.fallbackModelConfig?.id || findMatchingModelId(models, existingAccess?.fallbackModel ?? null));
  const primaryAccessKey = input.primaryAccessKey ?? existingAccess?.primaryAccessKey ?? null;
  const fallbackAccessKey = input.fallbackAccessKey ?? existingAccess?.fallbackAccessKey ?? null;
  const promptIdentifier =
    trimmedPromptId || existingAccess?.prompt_id || generateAccessIdentifier();

  if (
    !(
      (primaryModelId !== null && primaryAccessKey !== null) ||
      (fallbackModelId !== null && fallbackAccessKey !== null)
    )
  ) {
    throw new Error('Configure at least one model and one access token for the AI Agent.');
  }

  if (existingAccess) {
    await ensureIntelligenceTables();
    const db = getIntelligenceDbPool();
    const refreshedTokenHash = hashAccessToken(generateAccessToken());

    // Get access tokens to retrieve API keys
    const availableTokens = await getAccessTokens(accountId);
    const tokenMap = new Map(availableTokens.map((token) => [token.id, token.key]));

    const modelIds = Array.from(
      new Set([primaryModelId, fallbackModelId].filter((value): value is number => value !== null))
    );
    const selectedModels = new Map(models.map((model) => [model.id, model]));

    const primaryModel = primaryModelId !== null ? selectedModels.get(primaryModelId) ?? null : null;
    const fallbackModel = fallbackModelId !== null ? selectedModels.get(fallbackModelId) ?? null : null;

    if (modelIds.length !== 0 && (primaryModelId !== null && !primaryModel || fallbackModelId !== null && !fallbackModel)) {
      throw new Error('One or more selected models do not exist');
    }

    // Build model strings array with encrypted keys
    const modelStrings: string[] = [];
    if (primaryModel && primaryAccessKey) {
      const apiKey = tokenMap.get(primaryAccessKey) ?? null;
      modelStrings.push(buildModelString(primaryModel.provider, primaryModel.model, apiKey, primaryAccessKey));
    }
    if (fallbackModel && fallbackAccessKey) {
      const apiKey = tokenMap.get(fallbackAccessKey) ?? null;
      modelStrings.push(buildModelString(fallbackModel.provider, fallbackModel.model, apiKey, fallbackAccessKey));
    }

    // Build details object with unencrypted prompt and models with encrypted keys
    const details = buildDetailsObject(normalizeText(input.masterPrompt) || null, modelStrings);

    await db.query(
      `
        UPDATE "intelligence_access"
        SET
          key_hash = $1,
          details = $2::jsonb,
          max_tokens = $3,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $4 AND account_id = $5
      `,
      [
        refreshedTokenHash,
        JSON.stringify(details),
        input.maxTokens,
        existingAccess.id,
        accountId,
      ]
    );
  } else {
    // Get access tokens to retrieve API keys
    const availableTokens = await getAccessTokens(accountId);
    const tokenMap = new Map(availableTokens.map((token) => [token.id, token.key]));

    const modelIds = Array.from(
      new Set([primaryModelId, fallbackModelId].filter((value): value is number => value !== null))
    );
    const selectedModels = new Map(models.map((model) => [model.id, model]));

    const primaryModel = primaryModelId !== null ? selectedModels.get(primaryModelId) ?? null : null;
    const fallbackModel = fallbackModelId !== null ? selectedModels.get(fallbackModelId) ?? null : null;

    if (modelIds.length !== 0 && (primaryModelId !== null && !primaryModel || fallbackModelId !== null && !fallbackModel)) {
      throw new Error('One or more selected models do not exist');
    }

    await createIntelligenceAccessRecord({
      accessIdentifier: promptIdentifier,
      accountId,
      tokenHash: hashAccessToken(generateAccessToken()),
      status: 'prod',
      accessType: 'open',
      maxTokens: input.maxTokens,
      prompt: normalizeText(input.masterPrompt) || null,
      primaryModel: primaryModel && primaryAccessKey ? {
        provider: primaryModel.provider,
        model: primaryModel.model,
        apiKey: tokenMap.get(primaryAccessKey) ?? null,
        tokenId: primaryAccessKey,
      } : null,
      fallbackModel: fallbackModel && fallbackAccessKey ? {
        provider: fallbackModel.provider,
        model: fallbackModel.model,
        apiKey: tokenMap.get(fallbackAccessKey) ?? null,
        tokenId: fallbackAccessKey,
      } : null,
    });
  }

  const refreshedAccess = (await getIntelligenceAccesses(accountId)).find(
    (access) => access.prompt_id === promptIdentifier
  );

  if (!refreshedAccess) {
    throw new Error('Failed to save the intelligence prompt record for this AI Agent.');
  }

  return {
    access: refreshedAccess,
    createdPrompt: !existingAccess,
  };
}

async function finalizeRequestLog(input: {
  accessId: number;
  query: string;
  masterPrompt: string;
  context: string;
  modal: string;
  responseText: string;
  usageTokens: number;
  inputTokens: number;
  outputTokens: number;
  cost: number | null;
  currency: string | null;
  currentBalance: number;
}): Promise<number> {
  await ensureIntelligenceTables();
  const db = getIntelligenceDbPool();
  const balanceToDeduct = Math.max(input.cost || 0, 0);

  const updateResult = await db.query<{ balance: number }>(
    `
      UPDATE "intelligence_access"
      SET token_balance = GREATEST(token_balance - $1, 0)
      WHERE id = $2
      RETURNING token_balance AS balance
    `,
    [balanceToDeduct, input.accessId]
  );

  const remainingBalance = updateResult.rows[0]?.balance ?? Math.max(input.currentBalance - balanceToDeduct, 0);

  await db.query(
    `
      INSERT INTO "intelligence_log" (access_id, query, response, context, modal, currency, cost, "inputTokens", "outputTokens", balance)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `,
    [
      input.accessId,
      input.query,
      input.responseText,
      buildStoredContext(input.context, {
        guider: input.masterPrompt,
        query: input.query,
        status: 'success',
        usageTokens: input.usageTokens,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        estimatedCost: input.cost,
        currency: input.currency,
      }),
      input.modal,
      input.currency,
      input.cost,
      input.inputTokens,
      input.outputTokens,
      remainingBalance,
    ]
  );

  return remainingBalance;
}

async function logFailedRequest(input: {
  accessId: number;
  query: string;
  masterPrompt: string;
  context: string;
  modal: string;
  errorMessage: string;
  balance: number;
  currency: string | null;
}) {
  await ensureIntelligenceTables();
  const db = getIntelligenceDbPool();
  await db.query(
    `
      INSERT INTO "intelligence_log" (access_id, query, response, context, modal, currency, cost, "inputTokens", "outputTokens", balance)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `,
    [
      input.accessId,
      input.query,
      `ERROR: ${input.errorMessage}`,
      buildStoredContext(input.context, {
        guider: input.masterPrompt,
        query: input.query,
        status: 'error',
        usageTokens: 0,
        estimatedCost: null,
        currency: input.currency,
      }),
      input.modal,
      input.currency,
      null,
      0,
      0,
      input.balance,
    ]
  );
}

export async function executePipelineAiAgentAction(
  input: PipelineAiAgentExecutionInput
): Promise<PipelineAiAgentExecutionResult> {
  const accountId = await getCurrentIntelligenceAccountId();
  const { access, createdPrompt } = await upsertPipelinePromptRecord(input, accountId);
  const availableTokens = await getAccessTokens(accountId);
  const tokenMap = new Map(availableTokens.map((token) => [token.id, token.key]));
  const builtPrompt = buildPrompt(access.defPrompt, input.prompt, stringifyContext(input.context));

  if (!builtPrompt.renderedPrompt) {
    throw new Error('Provide a prompt, a guider, or some context for the AI Agent.');
  }

  const candidates = [
    access.primaryModelConfig
      ? {
          provider: access.primaryModelConfig.provider,
          model: access.primaryModelConfig.model,
          identifier: `${access.primaryModelConfig.provider}:${access.primaryModelConfig.model}`,
          modelConfig: access.primaryModelConfig,
          apiKey: access.primaryAccessKey ? tokenMap.get(access.primaryAccessKey) ?? null : null,
        }
      : null,
    access.fallbackModelConfig
      ? {
          provider: access.fallbackModelConfig.provider,
          model: access.fallbackModelConfig.model,
          identifier: `${access.fallbackModelConfig.provider}:${access.fallbackModelConfig.model}`,
          modelConfig: access.fallbackModelConfig,
          apiKey: access.fallbackAccessKey ? tokenMap.get(access.fallbackAccessKey) ?? null : null,
        }
      : null,
  ].filter(
    (
      candidate
    ): candidate is {
      provider: string;
      model: string;
      identifier: string;
      modelConfig: StoredModelConfig;
      apiKey: string;
    } => Boolean(candidate?.model && candidate?.apiKey)
  );

  if (candidates.length === 0) {
    throw new Error('No provider API key is linked to the selected intelligence model.');
  }

  let lastErrorMessage = 'Failed to generate response';

  for (const candidate of candidates) {
    try {
      const modelResult = await invokeModel({
        provider: candidate.provider,
        model: candidate.model,
        prompt: builtPrompt.renderedPrompt,
        maxTokens: access.maxTokens,
        apiKey: candidate.apiKey,
      });

      const estimatedCost = estimateModelCost(
        {
          currency: candidate.modelConfig.currency,
          inputCostPer1000Tokens: candidate.modelConfig.inputCostPer1000Tokens,
          outputCostPer1000Tokens: candidate.modelConfig.outputCostPer1000Tokens,
          price: candidate.modelConfig.price,
        },
        modelResult.inputTokens,
        modelResult.outputTokens,
        modelResult.usageTokens
      );

      const remainingBalance = await finalizeRequestLog({
        accessId: access.id,
        query: builtPrompt.query,
        masterPrompt: builtPrompt.masterPrompt,
        context: builtPrompt.context,
        modal: candidate.identifier,
        responseText: modelResult.responseText,
        usageTokens: modelResult.usageTokens,
        inputTokens: modelResult.inputTokens,
        outputTokens: modelResult.outputTokens,
        cost: estimatedCost.cost,
        currency: estimatedCost.currency,
        currentBalance: Number(access.balance),
      });

      revalidatePath('/intelligence/prompts');
      revalidatePath('/intelligence/logs');
      revalidatePath(`/intelligence/prompts/${access.id}`);

      return {
        promptId: access.prompt_id,
        responseText: modelResult.responseText,
        renderedPrompt: builtPrompt.renderedPrompt,
        usedModel: candidate.identifier,
        remainingBalance,
        createdPrompt,
      };
    } catch (error) {
      lastErrorMessage = error instanceof Error ? error.message : 'Failed to generate response';
    }
  }

  await logFailedRequest({
    accessId: access.id,
    query: builtPrompt.query,
    masterPrompt: builtPrompt.masterPrompt,
    context: builtPrompt.context,
    modal: candidates.map((candidate) => candidate.identifier).join(' -> '),
    errorMessage: lastErrorMessage,
    balance: Number(access.balance),
    currency: candidates[0]?.modelConfig.currency || null,
  });

  revalidatePath('/intelligence/logs');
  throw new Error(lastErrorMessage);
}

export async function savePipelineFlowAction(
  input: SavePipelineFlowInput
): Promise<SavePipelineFlowResult> {
  const accountId = await getCurrentIntelligenceAccountId();
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
  const accountId = await getCurrentIntelligenceAccountId();
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
  const accountId = await getCurrentIntelligenceAccountId();
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
