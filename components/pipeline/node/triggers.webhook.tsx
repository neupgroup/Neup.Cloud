'use client';

import { Webhook } from 'lucide-react';

import { definePipelineNodeModule } from '@/components/pipeline/node/interface';

export const webhookTriggerNodeModule = definePipelineNodeModule({
  definition: {
    kind: 'webhookTrigger',
    type: 'triggers',
    label: 'Webhook',
    subtitle: 'HTTP event',
    category: 'Triggers',
    description: 'Receive data from external services over an incoming HTTP request.',
    summary: 'Useful for lead capture, Git events, and custom automations.',
    icon: Webhook,
  },
});
