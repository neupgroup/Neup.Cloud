'use client';

export type PipelineIntelligenceModel = {
  id: number;
  title: string;
  provider: string;
  model: string;
};

export type PipelineIntelligencePrompt = {
  id: number;
  promptId: string;
  primaryModelId: number | null;
  fallbackModelId: number | null;
  primaryAccessKey: number | null;
  fallbackAccessKey: number | null;
  maxTokens: number | null;
  defPrompt: string | null;
};

export type PipelineIntelligenceToken = {
  id: number;
  name: string;
};

export type PipelineIntelligenceContext = {
  models: PipelineIntelligenceModel[];
  prompts: PipelineIntelligencePrompt[];
  tokens: PipelineIntelligenceToken[];
  modelOptionMap: Map<number, PipelineIntelligenceModel>;
  promptOptionMap: Map<string, PipelineIntelligencePrompt>;
  tokenOptionMap: Map<number, PipelineIntelligenceToken>;
};

export function createPipelineIntelligenceContext(input: {
  models: PipelineIntelligenceModel[];
  prompts: PipelineIntelligencePrompt[];
  tokens: PipelineIntelligenceToken[];
}): PipelineIntelligenceContext {
  return {
    models: input.models,
    prompts: input.prompts,
    tokens: input.tokens,
    modelOptionMap: new Map(input.models.map((model) => [model.id, model])),
    promptOptionMap: new Map(input.prompts.map((prompt) => [prompt.promptId, prompt])),
    tokenOptionMap: new Map(input.tokens.map((token) => [token.id, token])),
  };
}

export function buildPipelineIntelligenceModelLabel(model: PipelineIntelligenceModel): string {
  return `${model.title} (${model.provider}:${model.model})`;
}
