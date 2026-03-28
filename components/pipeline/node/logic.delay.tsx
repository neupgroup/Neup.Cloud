'use client';

import { Timer } from 'lucide-react';

import { definePipelineNodeModule } from '@/components/pipeline/node/interface';

export const delayNodeModule = definePipelineNodeModule({
  definition: {
    kind: 'delay',
    type: 'logic',
    label: 'Delay',
    subtitle: 'Wait state',
    category: 'Logic',
    description: 'Pause the execution before continuing.',
    summary: 'Useful for rate limits, follow-up windows, or retries.',
    icon: Timer,
  },
});
