import { getDomains } from '@/services/domains/domains-service';

export const domainsListTool = {
  name: 'domains_list',
  description: 'List managed domains.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
} as const;

// Return the managed domains through the existing domain service.
export async function listDomainsTool() {
  return getDomains();
}
