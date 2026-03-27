import type { ModelInvocationResult } from '@/actions/intelligence/types';
import { ensureApiKey, extractText, readErrorMessage } from '@/actions/intelligence/utils';

export async function invokeGeminiModel(input: {
  model: string;
  prompt: string;
  apiKey: string;
  maxTokens?: number | null;
}): Promise<ModelInvocationResult> {
  const resolvedApiKey = ensureApiKey(input.apiKey, 'google');
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:generateContent?key=${encodeURIComponent(resolvedApiKey)}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: input.prompt }],
        },
      ],
      ...(input.maxTokens ? { generationConfig: { maxOutputTokens: input.maxTokens } } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const payload = await response.json();
  const responseText = extractText(payload?.candidates?.[0]?.content?.parts);

  if (!responseText) {
    throw new Error('Google returned an empty response');
  }

  return {
    provider: 'google',
    model: input.model,
    responseText,
    usageTokens: Number(payload?.usageMetadata?.totalTokenCount) || 0,
    inputTokens: Number(payload?.usageMetadata?.promptTokenCount) || 0,
    outputTokens: Number(payload?.usageMetadata?.candidatesTokenCount) || 0,
  };
}
