import { prisma } from '#/core/database/prisma';
import { stringUuid } from '#/core/data/uuid';
import type { EnvironmentVariable } from '@/services/environment-variables/environment-variables-service';

function mapEnvironmentVariable(record: {
  id: string;
  key: string;
  value: string;
  targetType: string;
  selectedTargets: string[];
  isConfidential: boolean;
  protectValue: boolean;
  createdAt: Date;
}): EnvironmentVariable {
  return {
    id: record.id,
    key: record.key,
    value: record.value,
    targetType: record.targetType as EnvironmentVariable['targetType'],
    selectedTargets: record.selectedTargets,
    isConfidential: record.isConfidential,
    protectValue: record.protectValue,
    createdAt: record.createdAt.toISOString(),
  };
}

export async function getEnvironmentVariables() {
  const records = await prisma.environmentVariable.findMany({
    orderBy: { key: 'asc' },
  });

  return records.map(mapEnvironmentVariable);
}

export async function createEnvironmentVariable(data: Omit<EnvironmentVariable, 'id' | 'createdAt'>) {
  const record = await prisma.environmentVariable.create({
    data: {
      id: stringUuid(),
      key: data.key,
      value: data.value,
      targetType: data.targetType,
      selectedTargets: data.selectedTargets,
      isConfidential: data.isConfidential,
      protectValue: data.protectValue,
      createdAt: new Date(),
    },
  });

  return mapEnvironmentVariable(record);
}

export async function deleteEnvironmentVariable(id: string) {
  return prisma.environmentVariable.delete({
    where: { id },
  });
}
