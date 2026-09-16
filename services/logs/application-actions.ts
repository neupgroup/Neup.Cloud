'use server';

import { cookies } from 'next/headers';

import { getApplication } from '@/services/server/applications/_data';
import { getApplicationLogsForServer } from '@/services/logs/application';

export async function getApplicationLogs(applicationId: string, lines: number = 50) {
  const application = await getApplication(applicationId);
  if (!application) {
    return { error: 'Application not found' };
  }

  const cookieStore = await cookies();
  const serverId = cookieStore.get('selected_server')?.value;
  if (!serverId) {
    return { error: 'No server selected' };
  }

  return getApplicationLogsForServer(serverId, application.name, lines);
}
