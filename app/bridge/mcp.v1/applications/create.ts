import { createApplication } from '@/services/server/applications/service';
import type { CreateApplicationData } from '@/services/server/applications/_types';

export const applicationCreateTool = {
  name: 'applications_create',
  description: 'Create an application record.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      location: { type: 'string' },
      language: { type: 'string' },
      owner: { type: 'string' },
      appIcon: { type: 'string' },
      repository: { type: 'string' },
      networkAccess: { type: 'array', items: { type: 'string' } },
      commands: { type: 'object', additionalProperties: { type: 'string' } },
      information: { type: 'object' },
      environments: { type: 'object', additionalProperties: { type: 'string' } },
      files: { type: 'object', additionalProperties: { type: 'string' } },
    },
    required: ['name', 'location', 'language', 'owner'],
    additionalProperties: false,
  },
} as const;

// Validate required fields and create an application through the existing data service.
export async function createApplicationTool(input: Record<string, unknown>) {
  for (const key of ['name', 'location', 'language', 'owner'] as const) {
    if (typeof input[key] !== 'string' || !input[key].trim()) {
      throw new Error(`${key} must be a non-empty string.`);
    }
  }

  const applicationId = await createApplication(input as unknown as CreateApplicationData);
  return { id: applicationId };
}
