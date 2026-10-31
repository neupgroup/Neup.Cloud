'use client';

import { Calendar, GitBranch, Play, PlugZap, Zap, type LucideIcon } from 'lucide-react';

import { browserNodeModule } from '@/components/pipeline/node/action.browser';
import { databaseNodeModule } from '@/components/pipeline/node/action.database';
import { httpRequestNodeModule } from '@/components/pipeline/node/action.httprequest';
import { githubNodeModule } from '@/components/pipeline/node/integration.github';
import { googleNodeModule } from '@/components/pipeline/node/integration.google';
import { googleCalendarNodeModule } from '@/components/pipeline/node/integration.googlecalendar';
import { linkedinNodeModule } from '@/components/pipeline/node/integration.linkedin';
import {
  whatsappReactNodeModule,
  whatsappSendNodeModule,
  whatsappTriggerNodeModule,
} from '@/components/pipeline/node/integration.whatsapp';
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
    description: 'Connect the flow to concrete tools and provider-specific entry points.',
    icon: PlugZap,
  },
];

export const pipelineNodeModules: PipelineNodeModule[] = [
  manualStartNodeModule,
  webhookTriggerNodeModule,
  scheduleTriggerNodeModule,
  whatsappTriggerNodeModule,
  httpRequestNodeModule,
  browserNodeModule,
  whatsappSendNodeModule,
  whatsappReactNodeModule,
  databaseNodeModule,
  transformNodeModule,
  conditionNodeModule,
  delayNodeModule,
  googleNodeModule,
  githubNodeModule,
  linkedinNodeModule,
  googleCalendarNodeModule,
  endNodeModule,
];

export const pipelineNodeModuleMap = new Map(
  pipelineNodeModules.map((module) => [module.definition.kind, module] as const)
);
