import { prisma } from '@/services/prisma';
import { createId } from '@/services/shared/create-id';
import type { CommandSet, CommandSetCommand } from '@/services/command-sets/types';

function mapCommandSet(record: {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  commands: unknown;
  createdAt: Date;
}): CommandSet {
  return {
    id: record.id,
    userId: record.userId,
    name: record.name,
    description: record.description ?? undefined,
    commands: (record.commands as CommandSetCommand[]) ?? [],
    createdAt: record.createdAt.toISOString(),
  };
}

export async function createCommandSet(data: Omit<CommandSet, 'id' | 'createdAt'>) {
  const record = await prisma.commandSet.create({
    data: {
      id: createId(),
      userId: data.userId,
      name: data.name,
      description: data.description ?? null,
      commands: data.commands as any,
      createdAt: new Date(),
    },
  });

  return mapCommandSet(record);
}

export async function getCommandSetsByUserId(userId: string) {
  const records = await prisma.commandSet.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  return records.map(mapCommandSet);
}

export async function getCommandSetById(id: string) {
  const record = await prisma.commandSet.findUnique({
    where: { id },
  });

  return record ? mapCommandSet(record) : null;
}

export async function updateCommandSet(
  id: string,
  data: Partial<Omit<CommandSet, 'id' | 'createdAt' | 'userId'>>
) {
  const record = await prisma.commandSet.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description ?? null } : {}),
      ...(data.commands !== undefined ? { commands: data.commands as any } : {}),
    },
  });

  return mapCommandSet(record);
}

export async function deleteCommandSet(id: string) {
  return prisma.commandSet.delete({
    where: { id },
  });
}
