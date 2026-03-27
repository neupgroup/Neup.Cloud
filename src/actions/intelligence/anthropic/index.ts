import type { ModelInvocationResult } from '@/actions/intelligence/types';
import { ensureApiKey, extractText, readErrorMessage } from '@/actions/intelligence/utils';

export async function invokeAnthropicModel(input: {
  model: string;
  prompt: string;
  apiKey: string;
  maxTokens?: number | null;
}): Promise<ModelInvocationResult> {
  const resolvedApiKey = ensureApiKey(input.apiKey, 'anthropic');
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': resolvedApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: input.model,
      max_tokens: input.maxTokens || 1024,
      messages: [{ role: 'user', content: input.prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const payload = await response.json();
  const responseText = extractText(payload?.content);

  if (!responseText) {
    throw new Error('Anthropic returned an empty response');
  }

  const inputTokens = Number(payload?.usage?.input_tokens) || 0;
  const outputTokens = Number(payload?.usage?.output_tokens) || 0;

  return {
    provider: 'anthropic',
    model: input.model,
    responseText,
    usageTokens: inputTokens + outputTokens,
    inputTokens,
    outputTokens,
  };
}
