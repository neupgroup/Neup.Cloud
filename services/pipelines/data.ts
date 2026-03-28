import { Prisma } from '@prisma/client';

import { prisma } from '@/services/prisma';
import { createId } from '@/services/shared/create-id';

export interface StoredPipeline {
  id: string;
  accountId: string;
  title: string;
  description?: string;
  flowJson: Prisma.JsonValue;
}

function toJsonField(value: Prisma.InputJsonValue) {
  return value;
}

function mapPipeline(record: {
  id: string;
  accountId: string;
  title: string;
  description: string | null;
  flowJson: Prisma.JsonValue;
}): StoredPipeline {
  return {
    id: record.id,
    accountId: record.accountId,
    title: record.title,
    description: record.description ?? undefined,
    flowJson: record.flowJson,
  };
}

export async function getPipelinesByAccountId(accountId: string) {
  const records = await prisma.pipeline.findMany({
    where: { accountId },
    orderBy: [{ title: 'asc' }, { id: 'asc' }],
  });

  return records.map(mapPipeline);
}

export async function getPipelineById(id: string, accountId?: string) {
  const record = await prisma.pipeline.findFirst({
    where: {
      id,
      ...(accountId ? { accountId } : {}),
    },
  });

  return record ? mapPipeline(record) : null;
}

export async function createPipeline(data: {
  accountId: string;
  title: string;
  description?: string | null;
  flowJson: Prisma.InputJsonValue;
}) {
  const record = await prisma.pipeline.create({
    data: {
      id: createId(),
      accountId: data.accountId,
      title: data.title,
      description: data.description ?? null,
      flowJson: toJsonField(data.flowJson),
    },
  });

  return mapPipeline(record);
}

export async function updatePipeline(
  id: string,
  data: {
    title?: string;
    description?: string | null;
    flowJson?: Prisma.InputJsonValue;
  }
) {
  const record = await prisma.pipeline.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description ?? null } : {}),
      ...(data.flowJson !== undefined ? { flowJson: toJsonField(data.flowJson) } : {}),
    },
  });

  return mapPipeline(record);
}
