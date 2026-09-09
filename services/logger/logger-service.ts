'use server';

import {
  createLoggerActivity,
  ensureLoggerProject,
  getLoggerActivities,
  getPaginatedLoggerActivities,
  getLoggerActivitiesByType,
  getLoggerProjects,
  getLoggerActivitiesByProject,
  findProjectForIngest,
  countRecentErrors,
  createLoggerProject,
} from '@/services/logger/data';
import { redirect } from 'next/navigation';

type LogRequestInput = {
  projectId?: string;
  projectName?: string;
  slug?: string;
  ingestKey?: string;
  type?: string;
  data?: unknown;
};

export type LoggerActivityRecord = {
  id: string;
  type: string | null;
  data: unknown;
  loggedOn: string;
  project: {
    id: string;
    name: string;
    createdOn: string;
  };
};

function normalizeProjectName(input: LogRequestInput) {
  if (typeof input.projectName === 'string' && input.projectName.trim()) {
    return input.projectName.trim();
  }

  if (typeof input.projectId === 'string' && input.projectId.trim()) {
    return input.projectId.trim();
  }

  return '';
}

function mapLoggerActivity(record: Awaited<ReturnType<typeof createLoggerActivity>>): LoggerActivityRecord {
  return {
    id: record.id,
    type: record.type,
    data: record.data,
    loggedOn: record.loggedOn.toISOString(),
    project: {
      id: record.project.id,
      name: record.project.name,
      createdOn: record.project.createdOn.toISOString(),
    },
  };
}

export async function logActivity(input: LogRequestInput) {
  const projectName = normalizeProjectName(input);

  if (!projectName) {
    throw new Error('projectName or projectId is required.');
  }

  const project = await ensureLoggerProject({
    projectId: typeof input.projectId === 'string' ? input.projectId.trim() : undefined,
    projectName,
    slug: input.slug,
    ingestKey: input.ingestKey,
  });

  const activity = await createLoggerActivity({
    projectId: project.id,
    type: typeof input.type === 'string' && input.type.trim() ? input.type.trim() : undefined,
    data: input.data ?? {},
  });

  return mapLoggerActivity(activity);
}

export async function ingestError(input: LogRequestInput & { origin?: string | null }) {
  if (!input.slug || !input.ingestKey) throw new Error('project slug and ingestKey are required.');
  const project = await findProjectForIngest(input.ingestKey, input.slug);
  if (!project) throw new Error('Invalid logger project credentials.');
  const origin = input.origin?.trim() || '';
  const hostname = origin ? (() => { try { return new URL(origin).hostname.toLowerCase(); } catch { return ''; } })() : '';
  const allowed = (!origin && project.allowWithoutOrigin) || (hostname === 'localhost' && project.allowLocalhostErrors) || project.allowedErrorDomains.some((domain) => hostname === domain.toLowerCase() || hostname.endsWith(`.${domain.toLowerCase()}`));
  if (!allowed) throw new Error('Error origin is not allowed for this project.');
  const now = Date.now();
  if (await countRecentErrors(project.id, new Date(now - 60_000)) >= project.errorsPerMinute || await countRecentErrors(project.id, new Date(now - 600_000)) >= project.errorsPerTenMinutes) throw new Error('Logger error rate limit exceeded.');
  return logActivity({ projectId: project.id, projectName: project.name, type: 'error', data: input.data });
}

export async function getAllLoggerActivities(): Promise<LoggerActivityRecord[]> {
  const records = await getLoggerActivities();

  return records.map((record) => ({
    id: record.id,
    type: record.type,
    data: record.data,
    loggedOn: record.loggedOn.toISOString(),
    project: {
      id: record.project.id,
      name: record.project.name,
      createdOn: record.project.createdOn.toISOString(),
    },
  }));
}

export async function getPaginatedLoggerActivityRecords(page = 1, pageSize = 25) {
  const result = await getPaginatedLoggerActivities(page, pageSize);

  return {
    ...result,
    activities: result.activities.map(mapLoggerActivity),
  };
}

export async function getErrorLoggerActivities(): Promise<LoggerActivityRecord[]> {
  const records = await getLoggerActivitiesByType('error');

  return records.map((record) => ({
    id: record.id,
    type: record.type,
    data: record.data,
    loggedOn: record.loggedOn.toISOString(),
    project: {
      id: record.project.id,
      name: record.project.name,
      createdOn: record.project.createdOn.toISOString(),
    },
  }));
}

export async function getLoggerProjectRecords() { return getLoggerProjects(); }

export async function createLoggerProjectAction(formData: FormData) {
  'use server';
  const name = String(formData.get('name') ?? '').trim();
  const slug = String(formData.get('slug') ?? '').trim().toLowerCase();
  const ingestKey = String(formData.get('ingestKey') ?? '').trim();
  if (!name || !slug || !ingestKey) throw new Error('Name, slug, and ingest key are required.');
  await createLoggerProject({ name, slug, ingestKey, allowLocalhostErrors: formData.get('allowLocalhostErrors') === 'on', allowWithoutOrigin: formData.get('allowWithoutOrigin') === 'on', allowedErrorDomains: String(formData.get('allowedErrorDomains') ?? '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean), errorsPerMinute: Math.max(1, Number(formData.get('errorsPerMinute') ?? 60)), errorsPerTenMinutes: Math.max(1, Number(formData.get('errorsPerTenMinutes') ?? 300)) });
  redirect('/logger');
}
export async function getProjectLoggerActivityRecords(projectId: string, page = 1, pageSize = 25) {
  const result = await getLoggerActivitiesByProject(projectId, page, pageSize);
  return { ...result, activities: result.activities.map(mapLoggerActivity) };
}

export async function getFilteredLoggerActivityRecords(type?: string, page = 1, pageSize = 25) {
  if (type === 'error') {
    const activities = await getErrorLoggerActivities();
    const totalPages = Math.max(1, Math.ceil(activities.length / pageSize));
    const currentPage = Math.min(Math.max(1, page), totalPages);
    return { activities: activities.slice((currentPage - 1) * pageSize, currentPage * pageSize), currentPage, totalPages, total: activities.length };
  }
  return getPaginatedLoggerActivityRecords(page, pageSize);
}
