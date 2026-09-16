import { prisma } from '@neup/core/database/prisma';

export async function deleteApplication(id: string) {
  return prisma.application.delete({ where: { id } });
}
