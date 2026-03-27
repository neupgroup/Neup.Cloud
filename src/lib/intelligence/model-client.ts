import { invokeAnthropicModel } from '@/actions/intelligence/anthropic';
import { invokeGeminiModel } from '@/actions/intelligence/gemini';
import { invokeOpenAIModel } from '@/actions/intelligence/openai';
import type { ModelInvocationResult, SupportedProvider } from '@/actions/intelligence/types';

export interface ModelInvocationInput {
  provider?: string | null;
  model: string;
  prompt: string;
  maxTokens?: number | null;
  apiKey: string;
}

function normalizeModel(model: string): string {
  return model.trim();
}

function normalizeProvider(value: string | null | undefined): SupportedProvider | null {
  const normalized = (value || '').trim().toLowerCase();

  if (normalized === 'openai' || normalized === 'anthropic' || normalized === 'google') {
    return normalized;
  }

  return null;
}

function resolveProvider(model: string, provider?: string | null): { provider: SupportedProvider; modelName: string } {
  const normalized = normalizeModel(model);
  const normalizedProvider = normalizeProvider(provider);

  if (normalizedProvider) {
    return { provider: normalizedProvider, modelName: normalized };
  }

  const lowerModel = normalized.toLowerCase();

  if (lowerModel.startsWith('openai:') || lowerModel.startsWith('openai/')) {
    return { provider: 'openai', modelName: normalized.split(/[:/]/, 2)[1] || normalized };
  }

  if (lowerModel.startsWith('anthropic:') || lowerModel.startsWith('anthropic/')) {
    return { provider: 'anthropic', modelName: normalized.split(/[:/]/, 2)[1] || normalized };
  }

  if (lowerModel.startsWith('google:') || lowerModel.startsWith('google/')) {
    return { provider: 'google', modelName: normalized.split(/[:/]/, 2)[1] || normalized };
  }

  if (lowerModel.startsWith('gpt-') || lowerModel.startsWith('o1') || lowerModel.startsWith('o3') || lowerModel.startsWith('o4')) {
    return { provider: 'openai', modelName: normalized };
  }

  if (lowerModel.startsWith('claude')) {
    return { provider: 'anthropic', modelName: normalized };
  }

  if (lowerModel.startsWith('gemini')) {
    return { provider: 'google', modelName: normalized };
  }

  throw new Error(`Unsupported model "${model}"`);
}

export async function invokeModel(input: ModelInvocationInput): Promise<ModelInvocationResult> {
  const { provider, modelName } = resolveProvider(input.model, input.provider);

  switch (provider) {
    case 'openai':
      return invokeOpenAIModel({
        model: modelName,
        prompt: input.prompt,
        apiKey: input.apiKey,
        maxTokens: input.maxTokens,
      });
    case 'anthropic':
      return invokeAnthropicModel({
        model: modelName,
        prompt: input.prompt,
        apiKey: input.apiKey,
        maxTokens: input.maxTokens,
      });
    case 'google':
      return invokeGeminiModel({
        model: modelName,
        prompt: input.prompt,
        apiKey: input.apiKey,
        maxTokens: input.maxTokens,
      });
    default:
      throw new Error(`Unsupported provider for model "${input.model}"`);
  }
}
