import { getProcessCardStatus, type ServerProcess } from './status-card';
import type { Application } from './_types';

export function getStoredStatus(application: Application) {
  const syncInfo = application.information?.serverSync;

  if (!syncInfo || syncInfo.status !== 'matched') {
    return getProcessCardStatus(null);
  }

  return getProcessCardStatus({
    name: syncInfo.matchedProcessName || application.information?.supervisorServiceName || application.name,
    state: syncInfo.matchedProcessState || 'UNKNOWN',
    source: 'supervisor',
  });
}
