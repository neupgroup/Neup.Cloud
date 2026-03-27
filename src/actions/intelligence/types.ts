export type SupportedProvider = 'openai' | 'anthropic' | 'google';

export interface ModelInvocationResult {
  provider: SupportedProvider;
  model: string;
  responseText: string;
  usageTokens: number;
  inputTokens: number;
  outputTokens: number;
}
