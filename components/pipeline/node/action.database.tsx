'use client';

import { SquareTerminal } from 'lucide-react';

import { definePipelineNodeModule } from '@/components/pipeline/node/interface';

export const databaseNodeModule = definePipelineNodeModule({
  definition: {
    kind: 'database',
    type: 'actions',
    label: 'Database',
    subtitle: 'Read and write',
    category: 'Actions',
    description: 'Store outputs or hydrate the flow with context from a database.',
    summary: 'Useful for stateful workflows and audit-friendly persistence.',
    icon: SquareTerminal,
  },
});
