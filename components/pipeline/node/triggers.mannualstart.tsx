'use client';

import { Play } from 'lucide-react';

import { definePipelineNodeModule } from '@/components/pipeline/node/interface';

export const manualStartNodeModule = definePipelineNodeModule({
  definition: {
    kind: 'manualStart',
    type: 'triggers',
    label: 'Manual Start',
    subtitle: 'Run from dashboard',
    category: 'Triggers',
    description: 'Launch the pipeline on demand from the editor or a control surface.',
    summary: 'Good for draft flows and operator-driven actions.',
    icon: Play,
  },
});
