'use server';

import {
  createLoggerActivity,
  ensureLoggerProject,
  getLoggerActivities,
  getPaginatedLoggerActivities,
  getLoggerActivitiesByType,
} from '@/services/logger/data';

type LogRequestInput = {
  projectId?: string;
  projectName?: string;
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
  });

  const activity = await createLoggerActivity({
    projectId: project.id,
    type: typeof input.type === 'string' && input.type.trim() ? input.type.trim() : undefined,
    data: input.data ?? {},
  });

  return mapLoggerActivity(activity);
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
