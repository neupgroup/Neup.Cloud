import { Prisma } from '@prisma/client';
import type { CommandVariable, SavedCommand } from '@/app/server/commands/types';
import { prisma } from '@/services/prisma';
import { createId } from '@/services/shared/create-id';

function toJsonField(value: Prisma.InputJsonValue | null | undefined) {
  return value === undefined ? undefined : value === null ? Prisma.DbNull : value;
}

function mapSavedCommand(record: {
  id: string;
  name: string;
  command: string;
  description: string | null;
  nextCommands: string[];
  variables: Prisma.JsonValue;
}): SavedCommand {
  return {
    id: record.id,
    name: record.name,
    command: record.command,
    description: record.description ?? undefined,
    nextCommands: record.nextCommands,
    variables: (record.variables as CommandVariable[] | null) ?? undefined,
  };
}

export async function getSavedCommands() {
  const records = await prisma.savedCommand.findMany({
    orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }],
  });

  return records.map(mapSavedCommand);
}

export async function getSavedCommandById(id: string) {
  const record = await prisma.savedCommand.findUnique({
    where: { id },
  });

  return record ? mapSavedCommand(record) : null;
}

export async function createSavedCommand(data: {
  name: string;
  command: string;
  description?: string;
  nextCommands?: string[];
  variables?: CommandVariable[];
}) {
  const record = await prisma.savedCommand.create({
    data: {
      id: createId(),
      name: data.name,
      command: data.command,
      description: data.description ?? null,
      nextCommands: data.nextCommands ?? [],
      variables: toJsonField((data.variables ?? null) as Prisma.InputJsonValue | null),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  return mapSavedCommand(record);
}

export async function updateSavedCommand(id: string, data: {
  name: string;
  command: string;
  description?: string;
  nextCommands?: string[];
  variables?: CommandVariable[];
}) {
  const record = await prisma.savedCommand.update({
    where: { id },
    data: {
      name: data.name,
      command: data.command,
      description: data.description ?? null,
      nextCommands: data.nextCommands ?? [],
      variables: toJsonField((data.variables ?? null) as Prisma.InputJsonValue | null),
      updatedAt: new Date(),
    },
  });

  return mapSavedCommand(record);
}

export async function deleteSavedCommand(id: string) {
  return prisma.savedCommand.delete({
    where: { id },
  });
}
