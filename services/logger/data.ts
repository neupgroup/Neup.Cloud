import { randomUUID } from 'node:crypto';

import { prisma } from '#/core/database/prisma';

type EnsureProjectInput = {
  projectId?: string;
  projectName: string;
  slug?: string;
  ingestKey?: string;
};

type CreateLoggerActivityInput = {
  projectId: string;
  type?: string;
  data: unknown;
};

export async function createLoggerProject(input: {
  name: string; slug: string; ingestKey: string; allowLocalhostErrors: boolean;
  allowWithoutOrigin: boolean; allowedErrorDomains: string[];
  errorsPerMinute: number; errorsPerTenMinutes: number;
}) {
  return prisma.project.create({ data: { id: randomUUID(), createdOn: new Date(), ...input } });
}

export async function isLoggerSlugAvailable(slug: string) {
  const project = await prisma.project.findUnique({ where: { slug } });
  return !project;
}

export async function ensureLoggerProject(input: EnsureProjectInput) {
  const normalizedName = input.projectName.trim();

  if (!normalizedName) {
    throw new Error('Project name is required.');
  }

  const slug = (input.slug?.trim() || normalizedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `project-${randomUUID()}`).slice(0, 100);
  const ingestKey = input.ingestKey?.trim() || `legacy-${input.projectId?.trim() || randomUUID()}`;
  if (input.projectId?.trim()) {
    const existingProject = await prisma.project.findUnique({
      where: { id: input.projectId.trim() },
    });

    if (existingProject) {
      if (existingProject.name !== normalizedName) {
        return prisma.project.update({
          where: { id: existingProject.id },
          data: { name: normalizedName, slug, ingestKey },
        });
      }

      return existingProject;
    }

    return prisma.project.create({
      data: {
        id: input.projectId.trim(),
        name: normalizedName,
        createdOn: new Date(),
        slug,
        ingestKey,
      },
    });
  }

  return prisma.project.upsert({
    where: { slug },
    update: {},
    create: {
      id: randomUUID(),
      name: normalizedName,
      createdOn: new Date(),
      slug,
      ingestKey,
    },
  });
}

export async function findProjectForIngest(ingestKey: string, slug: string) {
  return prisma.project.findFirst({ where: { ingestKey, slug } });
}

export async function countRecentErrors(projectId: string, since: Date) {
  return prisma.loggerActivity.count({ where: { projectId, type: 'error', loggedOn: { gte: since } } });
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

export async function getLoggerProjects() {
  return prisma.project.findMany({ orderBy: { name: 'asc' } });
}

export async function getLoggerActivitiesByProject(projectId: string, page = 1, pageSize = 25) {
  const total = await prisma.loggerActivity.count({ where: { projectId } });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const activities = await prisma.loggerActivity.findMany({ where: { projectId }, include: { project: true }, orderBy: { loggedOn: 'desc' }, skip: (currentPage - 1) * pageSize, take: pageSize });
  return { activities, currentPage, totalPages, total };
}
