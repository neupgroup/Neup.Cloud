'use client';

import { Bot, Calendar, GitBranch, Play, Zap, type LucideIcon } from 'lucide-react';

import { browserNodeModule } from '@/components/pipeline/node/action.browser';
import { databaseNodeModule } from '@/components/pipeline/node/action.database';
import { httpRequestNodeModule } from '@/components/pipeline/node/action.httprequest';
import { aiAgentNodeModule } from '@/components/pipeline/node/intelligence.aiagent';
import { googleCalendarNodeModule } from '@/components/pipeline/node/integration.googlecalendar';
import { conditionNodeModule } from '@/components/pipeline/node/logic.condition';
import { delayNodeModule } from '@/components/pipeline/node/logic.delay';
import { endNodeModule } from '@/components/pipeline/node/logic.end';
import { transformNodeModule } from '@/components/pipeline/node/logic.transform';
import { type PipelineNodeModule, type PipelineNodeType } from '@/components/pipeline/node/interface';
import { manualStartNodeModule } from '@/components/pipeline/node/triggers.mannualstart';
import { scheduleTriggerNodeModule } from '@/components/pipeline/node/triggers.schedule';
import { webhookTriggerNodeModule } from '@/components/pipeline/node/triggers.webhook';

export type PipelineNodeCategoryDefinition = {
  id: PipelineNodeType;
  label: string;
  description: string;
  icon: LucideIcon;
};

export const pipelineNodeCategories: PipelineNodeCategoryDefinition[] = [
  {
    id: 'triggers',
    label: 'Triggers',
    description: 'Start a flow manually, on schedule, or from incoming events.',
    icon: Play,
  },
  {
    id: 'actions',
    label: 'Actions',
    description: 'Execute API calls, browser work, and storage steps.',
    icon: Zap,
  },
  {
    id: 'logic',
    label: 'Logic',
    description: 'Control how data moves and when the flow branches.',
    icon: GitBranch,
  },
  {
    id: 'integration',
    label: 'Integration',
    description: 'Connect the flow to concrete tools and endpoints.',
    icon: Calendar,
  },
  {
    id: 'intelligence',
    label: 'Intelligence',
    description: 'Reasoning, prompting, and model-powered workflow steps.',
    icon: Bot,
  },
];

export const pipelineNodeModules: PipelineNodeModule[] = [
  manualStartNodeModule,
  webhookTriggerNodeModule,
  scheduleTriggerNodeModule,
  httpRequestNodeModule,
  browserNodeModule,
  aiAgentNodeModule,
  databaseNodeModule,
  transformNodeModule,
  conditionNodeModule,
  delayNodeModule,
  googleCalendarNodeModule,
  endNodeModule,
];

export const pipelineNodeModuleMap = new Map(
  pipelineNodeModules.map((module) => [module.definition.kind, module] as const)
);
