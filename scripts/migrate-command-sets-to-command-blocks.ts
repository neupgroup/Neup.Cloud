import 'dotenv/config';

import { prisma } from '@/services/prisma';
import { serializeCommandSetCommands } from '@/services/command-sets/serialize';
import type { CommandSetCommand } from '@/services/command-sets/types';

async function main() {
  const commandSets = await prisma.commandSet.findMany({
    orderBy: { createdAt: 'asc' },
  });

  let migratedCount = 0;

  for (const commandSet of commandSets) {
    const existingSavedCommand = await prisma.savedCommand.findUnique({
      where: { id: commandSet.id },
    });

    if (existingSavedCommand) {
      continue;
    }

    const serializedCommand = serializeCommandSetCommands(commandSet.commands as CommandSetCommand[]);

    await prisma.savedCommand.create({
      data: {
        id: commandSet.id,
        name: commandSet.name,
        command: serializedCommand,
        description: commandSet.description,
        nextCommands: [],
        variables: [],
        createdAt: commandSet.createdAt,
        updatedAt: commandSet.createdAt,
      },
    });

    migratedCount += 1;
  }

  console.log(`Migrated ${migratedCount} command set(s) into saved command blocks.`);
}

main().catch((error) => {
  console.error('Command set migration failed:', error);
  process.exit(1);
});