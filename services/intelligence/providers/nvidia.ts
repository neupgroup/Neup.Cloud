import type { ModelInvocationResult } from '@/services/intelligence/types';
import { ensureApiKey, extractText, readErrorMessage } from '@/services/intelligence/provider-utils';

function normalizeNvidiaModel(value: string): string {
  const trimmed = value.trim();

  if (trimmed.includes(':')) {
    return trimmed.split(':')[0] || trimmed;
  }

  return trimmed;
}

export async function invokeNvidiaModel(input: {
  model: string;
  prompt: string;
  apiKey: string;
  maxTokens?: number | null;
}): Promise<ModelInvocationResult> {
  const resolvedApiKey = ensureApiKey(input.apiKey, 'nvidia');
  const model = normalizeNvidiaModel(input.model);
  const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resolvedApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: input.prompt }],
      ...(input.maxTokens ? { max_tokens: input.maxTokens } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const payload = await response.json();
  const responseText = extractText(payload?.choices?.[0]?.message?.content);

  if (!responseText) {
    throw new Error('NVIDIA returned an empty response');
  }

  return {
    provider: 'nvidia',
    model,
    responseText,
    usageTokens: Number(payload?.usage?.total_tokens) || 0,
    inputTokens: Number(payload?.usage?.prompt_tokens) || 0,
    outputTokens: Number(payload?.usage?.completion_tokens) || 0,
  };
}
