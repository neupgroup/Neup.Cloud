'use server';

import { syncApplicationsWithServer as syncWithServer } from './sync';
import { getApplications as getApplicationsData } from './_data';
import { getStoredStatus } from './stored-status';
import { getProcessCardStatus } from './status';
import { getSelectedServerId } from './session';
import type { Application } from './_types';
import type { ApplicationCardStatus, ServerProcess } from './status';

export type ApplicationItem = {
  id: string;
  application: Application;
  status: ApplicationCardStatus;
  href: string;
  sourceLabel?: string;
};

export type ApplicationSource = 'registered' | 'unregistered' | 'all';
export type ApplicationStatusFilter = 'running' | 'crashed' | 'stopped' | 'notRunning' | 'all';

const toneMap: Record<Exclude<ApplicationStatusFilter, 'all'>, string> = {
  running: 'green',
  crashed: 'orange',
  stopped: 'red',
  notRunning: 'gray',
};

async function buildAllItems(serverId?: string | null): Promise<ApplicationItem[]> {
  const selectedServerId = serverId ?? await getSelectedServerId();
  if (!selectedServerId) return [];

  const syncResult = await syncWithServer(selectedServerId);

  const registered: ApplicationItem[] = syncResult.applications.map((application) => ({
    id: application.id,
    application,
    status: getStoredStatus(application),
    href: `/server/applications/${application.id}`,
  }));

  const unregistered: ApplicationItem[] = syncResult.serverOnlyApplications.map((process: ServerProcess) => ({
    id: `${process.source}:${process.name}`,
    application: {
      id: `${process.source}:${process.name}`,
      name: process.name,
      appIcon: undefined,
      location: '',
      language: 'run.custom',
      owner: process.source,
    } satisfies Application,
    status: getProcessCardStatus(process),
    href: `/server/applications/${encodeURIComponent(`supervisor_${process.name}`)}`,
    sourceLabel: 'Supervisor',
  }));

  return [...registered, ...unregistered];
}

function filterByStatus(items: ApplicationItem[], filter: ApplicationStatusFilter | ApplicationStatusFilter[]): ApplicationItem[] {
  const filters = Array.isArray(filter) ? filter : [filter];
  if (filters.includes('all')) return items;
  const tones = new Set(filters.map((f) => toneMap[f as Exclude<ApplicationStatusFilter, 'all'>]));
  return items.filter((item) => tones.has(item.status.tone));
}

function filterBySource(items: ApplicationItem[], source: ApplicationSource): ApplicationItem[] {
  if (source === 'all') return items;
  if (source === 'registered') return items.filter((item) => !item.sourceLabel);
  if (source === 'unregistered') return items.filter((item) => !!item.sourceLabel);
  return items;
}

export async function getApplicationItems(
  source: ApplicationSource = 'all',
  statusFilter: ApplicationStatusFilter | ApplicationStatusFilter[] = 'all',
  selectedServerId?: string | null
): Promise<ApplicationItem[]> {
  const all = await buildAllItems(selectedServerId);
  return filterByStatus(filterBySource(all, source), statusFilter);
}

export async function getRunningApplications(selectedServerId?: string | null): Promise<ApplicationItem[]> {
  return getApplicationItems('all', 'running', selectedServerId);
}
