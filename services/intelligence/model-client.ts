'use server';

import { getResponse } from '#/core/intelligence';

export interface InvokeModelInput {
  provider: string | null;
  model: string | null;
  prompt: string;
  apiKey: string;
  maxTokens?: number | null;
}

export interface InvokeModelResult {
  provider: string;
  model: string;
  responseText: string;
  usageTokens: number;
  inputTokens: number;
  outputTokens: number;
}

function estimateTokens(value: string): number {
  return Math.max(1, Math.ceil(value.length / 4));
}

export async function invokeModel(input: InvokeModelInput): Promise<InvokeModelResult> {
  const provider = input.provider?.trim().toLowerCase() || undefined;
  const model = input.model?.trim() || '';
  const apiKey = input.apiKey.trim();

  if (!model) {
    throw new Error('Model is required.');
  }

  if (!apiKey) {
    throw new Error('Provider API key is required.');
  }

  const result = await getResponse(
    {
      prompt: input.prompt,
      outputType: 'text',
    },
    {
      provider,
      model,
      apiKey,
      maxTokens: input.maxTokens ?? undefined,
    }
  );

  const inputTokens = estimateTokens(input.prompt);
  const outputTokens = estimateTokens(result.response);

  return {
    provider: result.provider,
    model: result.model,
    responseText: result.response,
    usageTokens: inputTokens + outputTokens,
    inputTokens,
    outputTokens,
  };
}
