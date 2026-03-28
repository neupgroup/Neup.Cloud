'use client';

import { LayoutGrid } from 'lucide-react';

import { definePipelineNodeModule } from '@/components/pipeline/node/interface';

export const browserNodeModule = definePipelineNodeModule({
  definition: {
    kind: 'browser',
    type: 'actions',
    label: 'Browser',
    subtitle: 'Visual automation',
    category: 'Actions',
    description: 'Automate a browser task such as loading a page or submitting a form.',
    summary: 'Helpful for scraping, QA flows, and portal interactions.',
    icon: LayoutGrid,
  },
});
