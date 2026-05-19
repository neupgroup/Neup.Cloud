'use server';

import { revalidatePath } from 'next/cache';

import { buildSupervisorServiceName, createApplication as createApplicationRecord, generateSupervisorServiceToken } from './create';
import { deleteApplication as deleteApplicationRecord } from './delete';
import { getApplication as getApplicationRecord, getApplications as getApplicationsData } from './_data';
import type { Application, CreateApplicationData, UpdateApplicationData } from './_types';
import { syncApplicationsWithServer as syncApplicationsWithServerForServer } from './sync';
import { updateApplication as updateApplicationRecord } from './update';
import { getSelectedServerId } from './session';
import { ensureInitialApplicationServerMap, setApplicationPrimaryServer } from './server-map';

export async function getApplications(): Promise<Application[]> {
  return getApplicationsData();
}

export async function getApplication(id: string): Promise<Application | null> {
  const application = await getApplicationRecord(id);
  if (!application) return null;
  if (application.information?.supervisorServiceName) return application;

  const supervisorServiceName = buildSupervisorServiceName(id, generateSupervisorServiceToken());
  await updateApplicationRecord(id, {
    information: {
      ...(application.information ?? {}),
      supervisorServiceName,
    },
  });

  return getApplicationRecord(id);
}

export async function createApplication(appData: CreateApplicationData) {
  const application = await createApplicationRecord(appData);
  const selectedServerId = await getSelectedServerId();
  await ensureInitialApplicationServerMap(application.id, selectedServerId);
  revalidatePath('/server/applications');
  return application.id;
}

export async function deleteApplication(id: string) {
  await deleteApplicationRecord(id);
  revalidatePath('/server/applications');
}

export async function updateApplication(id: string, data: UpdateApplicationData) {
  if (Object.keys(data).length === 0) return;
  await updateApplicationRecord(id, data);
  revalidatePath('/server/applications');
  revalidatePath(`/server/applications/${id}`);
}

export async function choosePrimaryApplicationServer(applicationId: string, serverId: string) {
  await setApplicationPrimaryServer(applicationId, serverId);
  revalidatePath(`/server/applications/${applicationId}`);
}

export async function syncApplicationsWithServer() {
  const serverId = await getSelectedServerId();
  if (!serverId) {
    throw new Error('No server selected');
  }

  return syncApplicationsWithServerForServer(serverId);
}
