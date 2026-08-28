import { prisma } from '#/core/database/prisma';

export async function getErrors() {
  return prisma.appError.findMany({
    orderBy: { timestamp: 'desc' },
  });
}
