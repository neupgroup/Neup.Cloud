import { Prisma, prisma } from '#/core/database/prisma';
import { stringUuid } from '#/core/data/uuid';

export interface StoredPipeline {
  id: string;
  accountId: string;
  title: string;
  description?: string;
  flowJson: Prisma.JsonValue;
}

export interface StoredPipelineLog {
  id: string;
  pipelineId: string;
  timestamp: string;
  logBy: string;
  details: string;
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

function mapPipelineLog(record: {
  id: string;
  pipelineId: string;
  timestamp: Date;
  logBy: string;
  details: string;
}): StoredPipelineLog {
  return {
    id: record.id,
    pipelineId: record.pipelineId,
    timestamp: record.timestamp.toISOString(),
    logBy: record.logBy,
    details: record.details,
  };
}

export async function getPipelinesByAccountId(accountId: string): Promise<StoredPipeline[]> {
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
      id: stringUuid(),
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

export async function createPipelineLog(data: {
  pipelineId: string;
  logBy: string;
  details: string;
}) {
  const record = await (prisma as typeof prisma & {
    pipelineLog: {
      create: typeof prisma.pipeline.create;
    };
  }).pipelineLog.create({
    data: {
      id: stringUuid(),
      pipelineId: data.pipelineId,
      timestamp: new Date(),
      logBy: data.logBy,
      details: data.details,
    },
  });

  return mapPipelineLog(record);
}

export async function getPipelineLogsByPipelineId(
  pipelineId: string,
  options?: { limit?: number }
) {
  const records = await (prisma as typeof prisma & {
    pipelineLog: {
      findMany: typeof prisma.pipeline.findMany;
    };
  }).pipelineLog.findMany({
    where: { pipelineId },
    orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
    ...(options?.limit ? { take: options.limit } : {}),
  });

  return records.map(mapPipelineLog);
}

export async function deletePipelineLogsByPipelineId(pipelineId: string) {
  return (prisma as typeof prisma & {
    pipelineLog: {
      deleteMany: typeof prisma.pipeline.deleteMany;
    };
  }).pipelineLog.deleteMany({
    where: { pipelineId },
  });
}
