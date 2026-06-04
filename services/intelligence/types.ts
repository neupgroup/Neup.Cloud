export type SupportedProvider = 'openai' | 'anthropic' | 'google' | 'nvidia';

export interface ModelInvocationResult {
  provider: SupportedProvider;
  model: string;
  responseText: string;
  usageTokens: number;
  inputTokens: number;
  outputTokens: number;
}
