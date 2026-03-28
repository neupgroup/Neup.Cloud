'use client';

import { Clock3 } from 'lucide-react';

import { definePipelineNodeModule } from '@/components/pipeline/node/interface';

export const scheduleTriggerNodeModule = definePipelineNodeModule({
  definition: {
    kind: 'scheduleTrigger',
    type: 'triggers',
    label: 'Schedule',
    subtitle: 'Time-based',
    category: 'Triggers',
    description: 'Run this workflow on a recurring schedule.',
    summary: 'Great for daily digests, sync jobs, and periodic checks.',
    icon: Clock3,
  },
});
