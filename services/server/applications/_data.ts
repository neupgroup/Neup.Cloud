import { prisma } from '@/core/database/prisma';

import type { Application } from './_types';
import { mapApplication } from './_utils';

export async function getApplications(): Promise<Application[]> {
  const records = await prisma.application.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return records.map(mapApplication);
}

export async function getApplication(id: string): Promise<Application | null> {
  const record = await prisma.application.findUnique({
    where: { id },
  });

  return record ? mapApplication(record) : null;
}
