import { prisma } from '@neup/core/database/prisma';

export async function getErrors() {
  return prisma.appError.findMany({
    orderBy: { timestamp: 'desc' },
  });
}
