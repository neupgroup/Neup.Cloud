'use client';

import { executePipelineAiAgentAction, type PipelineAiAgentExecutionInput } from '@/services/pipelines/pipelines-service';
import {
  buildPipelineIntelligenceModelLabel,
  type PipelineIntelligenceContext,
} from '@/components/pipeline/node/intelligence.shared';
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert';
import { Badge } from '#/components/ui/badge';
import { Button } from '#/components/ui/button';
import { Input } from '#/components/ui/input';
import { Textarea } from '#/components/ui/textarea';
import {
  definePipelineNodeModule,
  type PipelineNodeInspectorArgs,
  type PipelineNodeRecord,
} from '@/components/pipeline/node/interface';
import { Bot, TriangleAlert } from 'lucide-react';

type AiNodeData = PipelineNodeRecord & {
  intelligencePromptMode?: 'existing' | 'new';
  intelligencePromptId?: string;
  intelligencePrimaryModelId?: number | null;
  intelligenceFallbackModelId?: number | null;
  intelligencePrimaryAccessKey?: number | null;
  intelligenceFallbackAccessKey?: number | null;
  intelligenceMaxTokens?: number | null;
  intelligenceMasterPrompt?: string;
  intelligencePrompt?: string;
  intelligenceContext?: string;
  intelligenceLastResponse?: string;
  intelligenceLastModel?: string;
  intelligenceLastRenderedPrompt?: string;
  intelligenceWarning?: string;
};

export function getAiAgentValidationError(
  node: AiNodeData,
  intelligence: PipelineIntelligenceContext
): string | null {
  if (intelligence.models.length === 0 || intelligence.tokens.length === 0) {
    return 'Configure at least one model and one access token for the AI Agent.';
  }

  const hasConfiguredPrimary =
    node.intelligencePrimaryModelId !== null &&
    node.intelligencePrimaryModelId !== undefined &&
    node.intelligencePrimaryAccessKey !== null &&
    node.intelligencePrimaryAccessKey !== undefined;
  const hasConfiguredFallback =
    node.intelligenceFallbackModelId !== null &&
    node.intelligenceFallbackModelId !== undefined &&
    node.intelligenceFallbackAccessKey !== null &&
    node.intelligenceFallbackAccessKey !== undefined;

  if (!hasConfiguredPrimary && !hasConfiguredFallback) {
    return 'Configure at least one model and one access token for the AI Agent.';
  }

  const hasPromptContent = [
    node.intelligencePrompt,
    node.intelligenceMasterPrompt,
    node.intelligenceContext,
  ].some((value) => Boolean(value?.trim()));

  if (!hasPromptContent) {
    return 'Provide a prompt, a guider, or some context for the AI Agent.';
  }

  return null;
}

export async function executeAiAgentNodeAction(
  input: PipelineAiAgentExecutionInput
) {
  return executePipelineAiAgentAction(input);
}

function AiNodeOptions({
  node,
  updateNode,
  clearWarning,
  intelligence,
}: PipelineNodeInspectorArgs<AiNodeData>) {
  const { models, prompts, tokens, modelOptionMap, promptOptionMap, tokenOptionMap } = intelligence;
  const promptMode: 'existing' = 'existing';
  const selectedPromptOption =
    node.data.intelligencePromptId ? promptOptionMap.get(node.data.intelligencePromptId) ?? null : null;

  return (
    <section className="space-y-4 px-1">
      <h3 className="text-lg font-semibold text-slate-950">Node options</h3>

      {promptMode === 'existing' ? (
        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Prompt ID
          </label>
          <select
            value={node.data.intelligencePromptId ?? ''}
            onChange={(event) => {
              clearWarning();
              const prompt = promptOptionMap.get(event.target.value);

              updateNode({
                intelligencePromptId: event.target.value,
                intelligencePrimaryModelId: prompt?.primaryModelId ?? null,
                intelligenceFallbackModelId: prompt?.fallbackModelId ?? null,
                intelligencePrimaryAccessKey: prompt?.primaryAccessKey ?? null,
                intelligenceFallbackAccessKey: prompt?.fallbackAccessKey ?? null,
                intelligenceMaxTokens: prompt?.maxTokens ?? null,
                intelligenceMasterPrompt: prompt?.guider ?? '',
              });
            }}
            className="flex h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-950 outline-none"
          >
            <option value="">Select a saved prompt</option>
            {prompts.map((prompt) => (
              <option key={prompt.id} value={prompt.promptId}>
                {prompt.promptId}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {promptMode === 'existing' && selectedPromptOption ? (
        <div className="space-y-3 rounded-[1.25rem] border border-slate-200 bg-slate-50/80 p-4">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Primary model</p>
            <p className="text-sm text-slate-900">
              {node.data.intelligencePrimaryModelId
                ? buildPipelineIntelligenceModelLabel(
                    modelOptionMap.get(node.data.intelligencePrimaryModelId) ?? {
                      id: node.data.intelligencePrimaryModelId,
                      title: 'Unknown model',
                      provider: 'unknown',
                      model: 'unknown',
                    }
                  )
                : 'Not configured'}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Fallback model</p>
            <p className="text-sm text-slate-900">
              {node.data.intelligenceFallbackModelId
                ? buildPipelineIntelligenceModelLabel(
                    modelOptionMap.get(node.data.intelligenceFallbackModelId) ?? {
                      id: node.data.intelligenceFallbackModelId,
                      title: 'Unknown model',
                      provider: 'unknown',
                      model: 'unknown',
                    }
                  )
                : 'None'}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Primary token</p>
            <p className="text-sm text-slate-900">
              {node.data.intelligencePrimaryAccessKey
                ? tokenOptionMap.get(node.data.intelligencePrimaryAccessKey)?.name ?? 'Unknown token'
                : 'Not configured'}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Fallback token</p>
            <p className="text-sm text-slate-900">
              {node.data.intelligenceFallbackAccessKey
                ? tokenOptionMap.get(node.data.intelligenceFallbackAccessKey)?.name ?? 'Unknown token'
                : 'None'}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Max tokens</p>
            <p className="text-sm text-slate-900">{node.data.intelligenceMaxTokens ?? 'Default'}</p>
          </div>

          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Guider</p>
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {node.data.intelligenceMasterPrompt?.trim() || 'No guider set for this saved prompt.'}
            </p>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Prompt
        </label>
        <Textarea
          value={node.data.intelligencePrompt ?? ''}
          onChange={(event) => {
            clearWarning();
            updateNode({ intelligencePrompt: event.target.value });
          }}
          placeholder="Dynamic prompt"
          className="min-h-[100px] rounded-2xl border-slate-200 bg-slate-50"
        />
      </div>

      <div className="space-y-2">
        <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Context
        </label>
        <Textarea
          value={node.data.intelligenceContext ?? ''}
          onChange={(event) => {
            clearWarning();
            updateNode({ intelligenceContext: event.target.value });
          }}
          placeholder="Dynamic context"
          className="min-h-[110px] rounded-2xl border-slate-200 bg-slate-50"
        />
      </div>

      {node.data.intelligenceWarning ? (
        <Alert variant="destructive" className="rounded-[1.25rem] border border-rose-200 bg-rose-50 text-rose-700 [&>svg]:text-rose-600">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>Pipeline warning</AlertTitle>
          <AlertDescription>{node.data.intelligenceWarning}</AlertDescription>
        </Alert>
      ) : null}
    </section>
  );
}

function AiNodeResponse({ node }: PipelineNodeInspectorArgs<AiNodeData>) {
  if (!node.data.intelligenceLastResponse) {
    return null;
  }

  return (
    <section className="space-y-4 px-1">
      <h3 className="text-lg font-semibold text-slate-950">Response</h3>
      <div className="space-y-3">
        <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          AI response
        </label>
        <Textarea
          readOnly
          value={node.data.intelligenceLastResponse}
          className="min-h-[120px] field-sizing-content rounded-2xl border-slate-200 bg-slate-50 text-sm leading-6 text-slate-700"
        />
      </div>
    </section>
  );
}

export const aiAgentNodeModule = definePipelineNodeModule<AiNodeData>({
  definition: {
    kind: 'aiAgent',
    type: 'intelligence',
    label: 'AI Agent',
    subtitle: 'Reasoning step',
    category: 'Intelligence',
    description: 'Run a prompt-driven task for summarization, routing, or generation.',
    summary: 'Use AI for scoring, drafting, and language-heavy decision points.',
    icon: Bot,
  },
  getInitialData: () => ({
    intelligencePromptMode: 'existing',
    intelligencePromptId: '',
    intelligencePrimaryModelId: null,
    intelligenceFallbackModelId: null,
    intelligencePrimaryAccessKey: null,
    intelligenceFallbackAccessKey: null,
    intelligenceMaxTokens: 500,
    intelligenceMasterPrompt: '',
    intelligencePrompt: '',
    intelligenceContext: '',
    intelligenceLastResponse: '',
    intelligenceLastModel: '',
    intelligenceLastRenderedPrompt: '',
    intelligenceWarning: '',
  }),
  getReferenceFields: () => [
    'promptMode',
    'promptId',
    'query',
    'masterPrompt',
    'context',
    'response',
    'renderedPrompt',
    'usedModel',
    'primaryModelId',
    'fallbackModelId',
    'primaryAccessKey',
    'fallbackAccessKey',
    'maxTokens',
    'warning',
  ],
  buildReferenceValue: (node) => ({
    promptMode: node.data.intelligencePromptMode ?? '',
    promptId: node.data.intelligencePromptId ?? '',
    query: node.data.intelligencePrompt ?? '',
    masterPrompt: node.data.intelligenceMasterPrompt ?? '',
    context: node.data.intelligenceContext ?? '',
    response: node.data.intelligenceLastResponse ?? '',
    renderedPrompt: node.data.intelligenceLastRenderedPrompt ?? '',
    usedModel: node.data.intelligenceLastModel ?? '',
    primaryModelId: node.data.intelligencePrimaryModelId ?? null,
    fallbackModelId: node.data.intelligenceFallbackModelId ?? null,
    primaryAccessKey: node.data.intelligencePrimaryAccessKey ?? null,
    fallbackAccessKey: node.data.intelligenceFallbackAccessKey ?? null,
    maxTokens: node.data.intelligenceMaxTokens ?? null,
    warning: node.data.intelligenceWarning ?? '',
  }),
  renderOptions: (args) => <AiNodeOptions {...args} />,
  renderResponse: (args) => <AiNodeResponse {...args} />,
});
