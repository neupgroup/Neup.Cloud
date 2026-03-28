'use client';

import { Sparkles } from 'lucide-react';

import { definePipelineNodeModule } from '@/components/pipeline/node/interface';

export const transformNodeModule = definePipelineNodeModule({
  definition: {
    kind: 'transform',
    type: 'logic',
    label: 'Transform',
    subtitle: 'Shape payload',
    category: 'Logic',
    description: 'Normalize, map, or enrich incoming data before the next step.',
    summary: 'Keep downstream nodes small by reshaping data early.',
    icon: Sparkles,
  },
});
