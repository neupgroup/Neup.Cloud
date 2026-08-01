import { prisma } from '@/services/prisma';
import { stringUuid } from '@/core/data/uuid';
import type { ManagedDomain } from '@/services/domains/types';

function mapDomain(record: {
  id: string;
  name: string;
  status: string;
  addedAt: Date;
  verificationCode: string | null;
  verified: boolean;
}): ManagedDomain {
  return {
    id: record.id,
    name: record.name,
    status: record.status as ManagedDomain['status'],
    addedAt: record.addedAt.toISOString(),
    verificationCode: record.verificationCode ?? undefined,
    verified: record.verified,
  };
}

export async function findDomainByName(name: string) {
  const record = await prisma.domain.findFirst({
    where: {
      name: {
        equals: name,
        mode: 'insensitive',
      },
    },
  });

  return record ? mapDomain(record) : null;
}

export async function createDomain(data: {
  name: string;
  verificationCode: string;
}) {
  const record = await prisma.domain.create({
    data: {
      id: stringUuid(),
      name: data.name,
      status: 'pending',
      addedAt: new Date(),
      verificationCode: data.verificationCode,
      verified: false,
    },
  });

  return mapDomain(record);
}

export async function getDomains() {
  const records = await prisma.domain.findMany({
    orderBy: { name: 'asc' },
  });

  return records.map(mapDomain);
}

export async function getDomainById(id: string) {
  const record = await prisma.domain.findUnique({
    where: { id },
  });

  return record ? mapDomain(record) : null;
}

export async function verifyDomain(id: string) {
  const record = await prisma.domain.update({
    where: { id },
    data: {
      verified: true,
      status: 'active',
    },
  });

  return mapDomain(record);
}

export async function deleteDomain(id: string) {
  return prisma.domain.delete({
    where: { id },
  });
}
