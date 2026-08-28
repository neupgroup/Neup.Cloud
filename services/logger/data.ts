import { randomUUID } from 'node:crypto';

import { prisma } from '#/core/database/prisma';

type EnsureProjectInput = {
  projectId?: string;
  projectName: string;
};

type CreateLoggerActivityInput = {
  projectId: string;
  type?: string;
  data: unknown;
};

export async function ensureLoggerProject(input: EnsureProjectInput) {
  const normalizedName = input.projectName.trim();

  if (!normalizedName) {
    throw new Error('Project name is required.');
  }

  if (input.projectId?.trim()) {
    const existingProject = await prisma.project.findUnique({
      where: { id: input.projectId.trim() },
    });

    if (existingProject) {
      if (existingProject.name !== normalizedName) {
        return prisma.project.update({
          where: { id: existingProject.id },
          data: { name: normalizedName },
        });
      }

      return existingProject;
    }

    return prisma.project.create({
      data: {
        id: input.projectId.trim(),
        name: normalizedName,
        createdOn: new Date(),
      },
    });
  }

  return prisma.project.upsert({
    where: { name: normalizedName },
    update: {},
    create: {
      id: randomUUID(),
      name: normalizedName,
      createdOn: new Date(),
    },
  });
}

export async function createLoggerActivity(input: CreateLoggerActivityInput) {
  return prisma.loggerActivity.create({
    data: {
      id: randomUUID(),
      projectId: input.projectId,
      type: input.type,
      data: input.data as object,
      loggedOn: new Date(),
    },
    include: {
      project: true,
    },
  });
}

export async function getLoggerActivities() {
  return prisma.loggerActivity.findMany({
    include: {
      project: true,
    },
    orderBy: {
      loggedOn: 'desc',
    },
  });
}

export async function getPaginatedLoggerActivities(page = 1, pageSize = 25) {
  const safePage = Math.max(1, Math.floor(page));
  const safePageSize = Math.max(1, Math.floor(pageSize));

  const total = await prisma.loggerActivity.count();
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const currentPage = Math.min(safePage, totalPages);
  const activities = await prisma.loggerActivity.findMany({
    include: {
      project: true,
    },
    orderBy: {
      loggedOn: 'desc',
    },
    skip: (currentPage - 1) * safePageSize,
    take: safePageSize,
  });

  return {
    activities,
    currentPage,
    totalPages,
    total,
  };
}

export async function getLoggerActivitiesByType(type: string) {
  return prisma.loggerActivity.findMany({
    where: {
      type,
    },
    include: {
      project: true,
    },
    orderBy: {
      loggedOn: 'desc',
    },
  });
}
