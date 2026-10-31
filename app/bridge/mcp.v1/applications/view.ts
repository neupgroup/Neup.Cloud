import { getApplication } from '@/services/server/applications/_data';

export const applicationViewTool = {
  name: 'applications_view',
  description: 'View an application by its ID.',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Application ID.' } },
    required: ['id'],
    additionalProperties: false,
  },
} as const;

// Return one stored application, or null when its ID is unknown.
export async function viewApplicationTool(input: Record<string, unknown>) {
  if (typeof input.id !== 'string' || !input.id.trim()) {
    throw new Error('id must be a non-empty string.');
  }

  return getApplication(input.id.trim());
}
