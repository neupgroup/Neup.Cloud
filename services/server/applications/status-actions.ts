'use server';

import { getApplication } from './_data';
import { getSupervisorProcesses } from './processes';
import { findBestSupervisorProcessForApplication } from './_utils';
import { upsertApplicationServerStatus } from './server-map';
import { executeQuickCommand } from '@/services/saved-commands/saved-commands-service';

export type AppStatusResult = {
  processStatus: 'running' | 'stopped' | 'error' | 'not_running' | 'unknown';
  availability: 'active' | 'inactive' | 'checking' | 'unknown';
  uptime: string;
  metrics: {
    memory?: string;
    cpu?: string;
  };
  lastChecked: string;
  details?: string;
};

function mapSupervisorStateToProcessStatus(state?: string): AppStatusResult['processStatus'] {
  const normalizedState = (state || '').toUpperCase();

  if (normalizedState === 'RUNNING') return 'running';
  if (normalizedState === 'FATAL' || normalizedState === 'BACKOFF' || normalizedState === 'ERRORED') return 'error';
  if (normalizedState === 'STOPPED' || normalizedState === 'EXITED' || normalizedState === 'STARTING') return 'stopped';
  return 'unknown';
}

export async function checkApplicationStatus(applicationId: string, selectedServerId?: string | null): Promise<AppStatusResult> {
  const app = await getApplication(applicationId);
  const now = new Date().toISOString();

  if (!app) {
    return { processStatus: 'unknown', availability: 'unknown', uptime: 'N/A', metrics: {}, lastChecked: now };
  }

  const serverId = selectedServerId?.trim() || null;

  if (!serverId) {
    return { processStatus: 'unknown', availability: 'unknown', uptime: 'N/A', metrics: {}, lastChecked: now, details: 'No server selected' };
  }

  let processStatus: AppStatusResult['processStatus'] = 'not_running';
  let uptime = 'N/A';
  let memory = undefined;
  let cpu = undefined;

  try {
    const allProcesses = await getSupervisorProcesses(serverId);
    const matchedProcess = Array.isArray(allProcesses)
      ? findBestSupervisorProcessForApplication(app.id, allProcesses, app.information?.supervisorServiceName)
      : null;

    if (matchedProcess) {
      processStatus = mapSupervisorStateToProcessStatus(matchedProcess.state);
      uptime = matchedProcess.uptime || (processStatus === 'running' ? 'Running' : '0m');

      if (matchedProcess.pid) {
        const psResult = await executeQuickCommand(serverId, `ps -p ${matchedProcess.pid} -o %cpu=,rss=`);

        if (!psResult.error && psResult.output) {
          const [cpuValue, rssValue] = psResult.output.trim().split(/\s+/);
          if (cpuValue) {
            cpu = `${cpuValue}%`;
          }
          if (rssValue) {
            memory = `${(Number(rssValue) / 1024).toFixed(1)} MB`;
          }
        }
      }
    }
  } catch (error) {
    console.warn('Failed to check supervisor status:', error);
    processStatus = 'unknown';
  }

  let availability: AppStatusResult['availability'] = 'unknown';

  if (processStatus === 'running' || processStatus === 'unknown') {
    const uniquePorts = app.networkAccess?.map(Number).filter((p: number) => !isNaN(p) && p > 0) || [];

    if (uniquePorts.length > 0) {
      const port = uniquePorts[0];
      const curlCmd = `curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:${port}`;
      const curlResult = await executeQuickCommand(serverId, curlCmd);

      if (curlResult.exitCode === 0) {
        const httpCode = parseInt((curlResult.output || '').trim(), 10);
        availability = !isNaN(httpCode) && httpCode >= 200 && httpCode < 400 ? 'active' : 'inactive';
      } else {
        availability = 'inactive';
      }
    }
  } else {
    availability = 'inactive';
  }

  if (processStatus === 'running') {
    await upsertApplicationServerStatus(applicationId, serverId, 'started');
  } else if (processStatus === 'stopped' || processStatus === 'error' || processStatus === 'not_running') {
    await upsertApplicationServerStatus(applicationId, serverId, 'stopped');
  } else {
    await upsertApplicationServerStatus(applicationId, serverId, 'inactive');
  }

  return {
    processStatus,
    availability,
    uptime,
    metrics: { memory, cpu },
    lastChecked: now,
  };
}
