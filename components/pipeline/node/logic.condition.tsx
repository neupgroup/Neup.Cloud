'use client';

import { GitBranch } from 'lucide-react';

import { definePipelineNodeModule } from '@/components/pipeline/node/interface';

export const conditionNodeModule = definePipelineNodeModule({
  definition: {
    kind: 'condition',
    type: 'logic',
    label: 'Condition',
    subtitle: 'If / else',
    category: 'Logic',
    description: 'Branch based on filters or rule checks.',
    summary: 'Send data to different paths depending on its contents.',
    icon: GitBranch,
  },
});
