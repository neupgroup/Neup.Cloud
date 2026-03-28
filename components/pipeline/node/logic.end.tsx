'use client';

import { ShieldCheck } from 'lucide-react';

import { definePipelineNodeModule } from '@/components/pipeline/node/interface';

export const endNodeModule = definePipelineNodeModule({
  definition: {
    kind: 'end',
    type: 'logic',
    label: 'End',
    subtitle: 'Stop flow',
    category: 'Logic',
    description: 'Mark the clean finish of the pipeline.',
    summary: 'Use it to make flow endings explicit and readable.',
    icon: ShieldCheck,
  },
});
