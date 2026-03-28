'use client';

import { Calendar } from 'lucide-react';

import { definePipelineNodeModule } from '@/components/pipeline/node/interface';

export const googleCalendarNodeModule = definePipelineNodeModule({
  definition: {
    kind: 'googleCalendar',
    type: 'integration',
    label: 'Google Calendar',
    subtitle: 'Event automation',
    category: 'Integration',
    description: 'Create, update, or inspect events from the workflow.',
    summary: 'Coordinate scheduling directly from the automation canvas.',
    icon: Calendar,
  },
});
