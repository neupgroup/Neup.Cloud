import type { ModelInvocationResult } from '@/actions/intelligence/types';
import { ensureApiKey, extractText, readErrorMessage } from '@/actions/intelligence/utils';

export async function invokeOpenAIModel(input: {
  model: string;
  prompt: string;
  apiKey: string;
  maxTokens?: number | null;
}): Promise<ModelInvocationResult> {
  const resolvedApiKey = ensureApiKey(input.apiKey, 'openai');
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resolvedApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: input.model,
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
    throw new Error('OpenAI returned an empty response');
  }

  return {
    provider: 'openai',
    model: input.model,
    responseText,
    usageTokens: Number(payload?.usage?.total_tokens) || 0,
    inputTokens: Number(payload?.usage?.prompt_tokens) || 0,
    outputTokens: Number(payload?.usage?.completion_tokens) || 0,
  };
}
