import { getApplications } from '@/services/server/applications/_data';
import { getApplicationsWithServerStatus } from '@/services/server/applications/status-actions';

export const applicationsListTool = {
  name: 'applications_list',
  description: 'List applications, optionally including their live status on a server.',
  inputSchema: {
    type: 'object',
    properties: {
      serverId: { type: 'string', description: 'Optional server ID, name, or IP for live application status.' },
      serverName: { type: 'string', description: 'Optional server name for live application status.' },
    },
    additionalProperties: false,
  },
} as const;

// Return all applications, adding live status when an authorized server is supplied.
export async function listApplicationsTool(input: Record<string, unknown> = {}) {
  const serverIdentifier = input.serverId ?? input.serverName;
  if (serverIdentifier !== undefined) {
    if (typeof serverIdentifier !== 'string' || !serverIdentifier.trim()) {
      throw new Error('serverId or serverName must be a non-empty string when provided.');
    }
    const accountId = typeof input.accountId === 'string' ? input.accountId : undefined;
    return getApplicationsWithServerStatus(serverIdentifier.trim(), accountId);
  }

  return getApplications();
}
