/**
 * prisma/seed.ts
 *
 * Seeds the authz tables with the `cloud.individual.default` role and its
 * full set of capabilities across domains, pipelines, intelligence, and servers.
 *
 * Run with: npx prisma db seed
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// Role definition
// ---------------------------------------------------------------------------

const ROLE = {
  id: 'cloud.individual.default',
  name: 'cloud.individual.default',
  description: 'Default role for individual NeupCloud accounts. Grants full access to all personal resources.',
  scope: 'cloud',
};

// ---------------------------------------------------------------------------
// Capability definitions
// ---------------------------------------------------------------------------

const CAPABILITIES = [
  // Domains
  { id: 'cloud:domains:read',   name: 'cloud:domains:read',   description: 'View domains',           scope: 'cloud' },
  { id: 'cloud:domains:create', name: 'cloud:domains:create', description: 'Add domains',            scope: 'cloud' },
  { id: 'cloud:domains:update', name: 'cloud:domains:update', description: 'Update domain settings', scope: 'cloud' },
  { id: 'cloud:domains:delete', name: 'cloud:domains:delete', description: 'Remove domains',         scope: 'cloud' },
  { id: 'cloud:domains:verify', name: 'cloud:domains:verify', description: 'Verify domain ownership',scope: 'cloud' },

  // Pipelines
  { id: 'cloud:pipelines:read',    name: 'cloud:pipelines:read',    description: 'View pipelines',         scope: 'cloud' },
  { id: 'cloud:pipelines:create',  name: 'cloud:pipelines:create',  description: 'Create pipelines',       scope: 'cloud' },
  { id: 'cloud:pipelines:update',  name: 'cloud:pipelines:update',  description: 'Edit pipelines',         scope: 'cloud' },
  { id: 'cloud:pipelines:delete',  name: 'cloud:pipelines:delete',  description: 'Delete pipelines',       scope: 'cloud' },
  { id: 'cloud:pipelines:execute', name: 'cloud:pipelines:execute', description: 'Run pipeline executions',scope: 'cloud' },

  // Intelligence
  { id: 'cloud:intelligence:read',    name: 'cloud:intelligence:read',    description: 'View intelligence resources',      scope: 'cloud' },
  { id: 'cloud:intelligence:create',  name: 'cloud:intelligence:create',  description: 'Create intelligence access keys',  scope: 'cloud' },
  { id: 'cloud:intelligence:update',  name: 'cloud:intelligence:update',  description: 'Update intelligence configuration',scope: 'cloud' },
  { id: 'cloud:intelligence:delete',  name: 'cloud:intelligence:delete',  description: 'Delete intelligence resources',    scope: 'cloud' },
  { id: 'cloud:intelligence:query',   name: 'cloud:intelligence:query',   description: 'Send queries to intelligence API', scope: 'cloud' },
  { id: 'cloud:intelligence:billing', name: 'cloud:intelligence:billing', description: 'View intelligence billing & logs', scope: 'cloud' },

  // Servers
  { id: 'cloud:servers:read',    name: 'cloud:servers:read',    description: 'View servers',              scope: 'cloud' },
  { id: 'cloud:servers:create',  name: 'cloud:servers:create',  description: 'Add servers',               scope: 'cloud' },
  { id: 'cloud:servers:update',  name: 'cloud:servers:update',  description: 'Update server configuration',scope: 'cloud' },
  { id: 'cloud:servers:delete',  name: 'cloud:servers:delete',  description: 'Remove servers',            scope: 'cloud' },
  { id: 'cloud:servers:shell',   name: 'cloud:servers:shell',   description: 'Open shell sessions',       scope: 'cloud' },
  { id: 'cloud:servers:deploy',  name: 'cloud:servers:deploy',  description: 'Deploy applications',       scope: 'cloud' },
  { id: 'cloud:servers:logs',    name: 'cloud:servers:logs',    description: 'View server logs',          scope: 'cloud' },
];

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function main() {
  console.log('Seeding authz role and capabilities...');

  // Upsert the role
  await prisma.authzRole.upsert({
    where: { id: ROLE.id },
    update: { name: ROLE.name, description: ROLE.description, scope: ROLE.scope },
    create: ROLE,
  });
  console.log(`  ✓ Role: ${ROLE.name}`);

  // Upsert all capabilities
  for (const cap of CAPABILITIES) {
    await prisma.authzCapability.upsert({
      where: { id: cap.id },
      update: { name: cap.name, description: cap.description, scope: cap.scope },
      create: cap,
    });
  }
  console.log(`  ✓ Capabilities: ${CAPABILITIES.length} upserted`);

  // Link all capabilities to the role via authz_role_capability
  for (const cap of CAPABILITIES) {
    const linkId = `${ROLE.id}::${cap.id}`;
    await prisma.authzRoleCapability.upsert({
      where: { id: linkId },
      update: {
        roleName: ROLE.name,
        denormalizedCapability: { id: cap.id, name: cap.name, description: cap.description, scope: cap.scope },
      },
      create: {
        id: linkId,
        roleId: ROLE.id,
        capabilityId: cap.id,
        scope: cap.scope,
        roleName: ROLE.name,
        denormalizedCapability: { id: cap.id, name: cap.name, description: cap.description, scope: cap.scope },
      },
    });
  }
  console.log(`  ✓ Role-capability links: ${CAPABILITIES.length} upserted`);

  console.log('Done.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
