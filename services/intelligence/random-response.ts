import { invokeModel } from '@/core/ai/files/intelligence/model-client';

export type AiResponseModelTuple = [apiKey: string, provider: string, modelCode: string];

export interface AiResponseCandidate {
  apiKey: string;
  provider: string;
  model: string;
}

export interface ExecuteRandomAiResponseInput {
  prompt: string;
  context?: string;
  models: AiResponseCandidate[];
}

export interface ExecuteRandomAiResponseResult {
  success: boolean;
  response?: string;
  modelUsed?: string;
  provider?: string;
  attempts?: number;
  error?: string;
  statusCode?: number;
}

function normalizeCandidate(candidate: AiResponseCandidate): AiResponseCandidate {
  return {
    apiKey: candidate.apiKey.trim(),
    provider: candidate.provider.trim(),
    model: candidate.model.trim(),
  };
}

function shuffleCandidates<T>(values: T[]): T[] {
  const shuffled = [...values];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

export function parseModelCandidates(input: unknown): AiResponseCandidate[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((candidate) => {
      if (Array.isArray(candidate)) {
        const [apiKey, provider, modelCode] = candidate;

        if (typeof apiKey === 'string' && typeof provider === 'string' && typeof modelCode === 'string') {
          return normalizeCandidate({ apiKey, provider, model: modelCode });
        }

        return null;
      }

      if (
        candidate &&
        typeof candidate === 'object' &&
        typeof (candidate as { apiKey?: unknown }).apiKey === 'string' &&
        typeof (candidate as { provider?: unknown }).provider === 'string' &&
        typeof (candidate as { model?: unknown }).model === 'string'
      ) {
        return normalizeCandidate(candidate as AiResponseCandidate);
      }

      return null;
    })
    .filter((candidate): candidate is AiResponseCandidate => Boolean(candidate?.apiKey && candidate?.provider && candidate?.model));
}

export async function executeRandomAiResponse(
  input: ExecuteRandomAiResponseInput
): Promise<ExecuteRandomAiResponseResult> {
  const primaryPrompt = input.context
    ? `Context:\n${input.context}\n\nPrompt:\n${input.prompt}`
    : input.prompt;

  if (!input.prompt.trim()) {
    return {
      success: false,
      error: 'prompt is required',
      statusCode: 400,
    };
  }

  if (input.models.length === 0) {
    return {
      success: false,
      error: 'At least one valid model tuple is required',
      statusCode: 400,
    };
  }

  const candidates = shuffleCandidates(input.models.map(normalizeCandidate));
  let lastErrorMessage = 'Failed to generate response';

  for (const [index, candidate] of candidates.entries()) {
    try {
      const result = await invokeModel({
        provider: candidate.provider,
        model: candidate.model,
        prompt: primaryPrompt,
        apiKey: candidate.apiKey,
      });

      return {
        success: true,
        response: result.responseText,
        provider: result.provider,
        modelUsed: result.model,
        attempts: index + 1,
      };
    } catch (error) {
      lastErrorMessage = error instanceof Error ? error.message : 'Failed to generate response';
    }
  }

  return {
    success: false,
    error: lastErrorMessage,
    attempts: candidates.length,
    statusCode: 500,
  };
}