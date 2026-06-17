'use server';

import { revalidatePath } from 'next/cache';

import { executeCommand, executeQuickCommand } from '@/services/saved-commands/saved-commands-service';

import { getRunningProcesses as getRunningProcessesForServer, getSupervisorProcesses as getSupervisorProcessesForServer } from './processes';

export async function getRunningProcesses(selectedServerId?: string | null) {
  const serverId = selectedServerId?.trim() || null;
  if (!serverId) throw new Error('No server selected');
  return getRunningProcessesForServer(serverId);
}

export async function getSupervisorProcesses(selectedServerId?: string | null) {
  const serverId = selectedServerId?.trim() || null;
  if (!serverId) throw new Error('No server selected');
  return getSupervisorProcessesForServer(serverId);
}

export async function restartApplicationProcess(serverId: string, pmId: string | number) {
  if (!serverId) return { error: 'Server not selected' };

  const result = await executeQuickCommand(serverId, `pm2 restart ${pmId}`);
  if (result.error) {
    return { error: result.error };
  }

  return { success: true, output: result.output };
}

export async function restartSupervisorProcess(serverId: string, name: string) {
  if (!serverId) return { error: 'Server not selected' };

  const result = await executeQuickCommand(serverId, `sudo supervisorctl restart ${name}`);
  if (result.error) {
    return { error: result.error };
  }

  return { success: true, output: result.output };
}

export async function stopSupervisorOnlyProcess(name: string, selectedServerId?: string | null) {
  const serverId = selectedServerId?.trim() || null;
  if (!serverId) throw new Error('No server selected');

  const result = await executeQuickCommand(serverId, `sudo supervisorctl stop '${name}' || true`);
  if (result.error) {
    throw new Error(result.error);
  }

  revalidatePath('/server/applications');
  revalidatePath(`/server/applications/${encodeURIComponent(`supervisor_${name}`)}`);
  return { success: true, output: result.output };
}

export async function deleteSupervisorOnlyProcess(name: string, selectedServerId?: string | null) {
  const serverId = selectedServerId?.trim() || null;
  if (!serverId) throw new Error('No server selected');

  const command = `
sudo supervisorctl stop '${name}' >/dev/null 2>&1 || true
sudo rm -f '/etc/supervisor/conf.d/${name}.conf' || true
sudo supervisorctl reread >/dev/null 2>&1 || true
sudo supervisorctl update >/dev/null 2>&1 || true
`;

  const result = await executeQuickCommand(serverId, command);
  if (result.error) {
    throw new Error(result.error);
  }

  revalidatePath('/server/applications');
  revalidatePath(`/server/applications/${encodeURIComponent(`supervisor_${name}`)}`);
  return { success: true, output: result.output };
}

export async function resetSupervisorConfiguration(serverId: string) {
  if (!serverId) return { error: 'Server not selected' };

  const result = await executeQuickCommand(serverId, 'sudo supervisorctl reread && sudo supervisorctl update');
  if (result.error) {
    return { error: result.error };
  }

  return { success: true, output: result.output };
}

export async function purgeSupervisor(serverId: string) {
  if (!serverId) return { error: 'Server not selected' };

  const command = `
sudo systemctl stop supervisor || true
sudo systemctl disable supervisor || true
sudo apt-get purge -y supervisor
sudo rm -rf /etc/supervisor
sudo rm -rf /var/log/supervisor
sudo rm -rf /var/run/supervisor*
sudo rm -rf /usr/lib/systemd/system/supervisor.service
sudo rm -rf /lib/systemd/system/supervisor.service
sudo systemctl daemon-reexec
sudo systemctl daemon-reload
which supervisord || echo "Supervisor removed"
  `.trim();

  const result = await executeCommand(serverId, command, 'Purge Supervisor', command);
  if (result.error) {
    return { error: result.error };
  }

  return { success: true, output: result.output };
}

export async function saveRunningProcesses(serverId: string) {
  if (!serverId) return { error: 'Server not selected' };

  const saveResult = await executeQuickCommand(serverId, 'pm2 save --force');
  if (saveResult.error) {
    return { error: saveResult.error };
  }

  const startupResult = await executeQuickCommand(serverId, 'pm2 startup');
  const output = startupResult.output || '';
  const commandMatch = output.match(/sudo env PATH=[^\n]+/);

  if (commandMatch) {
    await executeQuickCommand(serverId, commandMatch[0]);
  }

  revalidatePath('/server/applications');
  return { success: true, output: saveResult.output };
}

export async function rebootSystem(serverId: string) {
  if (!serverId) return { error: 'Server not selected' };

  const result = await executeQuickCommand(serverId, 'sudo reboot');

  if (
    result.error &&
    !result.error.toLowerCase().includes('closed') &&
    !result.error.toLowerCase().includes('timeout') &&
    !result.error.toLowerCase().includes('reset')
  ) {
    return { error: result.error };
  }

  return { success: true, message: 'Reboot initiated.' };
}

export async function getProcessDetails(provider: string, name: string, selectedServerId?: string | null) {
  const serverId = selectedServerId?.trim() || null;
  if (!serverId) throw new Error('No server selected');

  if (provider === 'supervisor') {
    const statusResult = await executeQuickCommand(serverId, `sudo supervisorctl status ${name}`);
    if (statusResult.error || !statusResult.output) return null;

    const output = (statusResult.output || '').trim();
    if (!output || output.includes('No such process')) return null;

    const lines = output.split('\n');
    let match: RegExpMatchArray | null = null;

    for (const line of lines) {
      const trimmed = line.trim();
      const candidate = trimmed.match(/^(\S+)\s+(\S+)\s+(.*)$/);
      if (!candidate) continue;

      const processName = candidate[1];
      if (processName === name || processName.endsWith(`:${name}`)) {
        match = candidate;
        break;
      }
    }

    if (!match) return null;

    const state = match[2];
    const description = match[3];
    let pid = 0;

    const pidMatch = description.match(/pid (\d+)/);
    if (pidMatch) pid = parseInt(pidMatch[1], 10);

    let cpu = 0;
    let memory = 0;
    let startTime = 0;

    if (pid > 0) {
      const psResult = await executeQuickCommand(serverId, `ps -p ${pid} -o %cpu,rss,lstart --no-headers`);

      if (!psResult.error && psResult.output) {
        const trimmed = psResult.output.trim();
        const firstSpace = trimmed.indexOf(' ');
        const secondSpace = trimmed.indexOf(' ', firstSpace + 1);

        if (firstSpace > -1 && secondSpace > -1) {
          const cpuString = trimmed.substring(0, firstSpace);
          const memoryString = trimmed.substring(firstSpace + 1, secondSpace);
          const dateString = trimmed.substring(secondSpace + 1);

          cpu = parseFloat(cpuString) || 0;
          memory = (parseInt(memoryString) || 0) * 1024;
          startTime = new Date(dateString).getTime();
        }
      }
    }

    const cleanName = name.includes(':') ? name.split(':')[1] : name;
    const configResult = await executeQuickCommand(
      serverId,
      `grep -r -l "\\[program:${cleanName}\\]" /etc/supervisor/conf.d/ /etc/supervisor/supervisord.conf 2>/dev/null | head -n 1 | xargs -I {} cat {}`
    );

    const config = {
      command: '',
      directory: '',
      user: '',
      stdout_logfile: '',
      stderr_logfile: '',
    };

    if (!configResult.error && configResult.output) {
      const lines = configResult.output.split('\n');
      let inSection = false;

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith(`[program:${cleanName}]`)) {
          inSection = true;
          continue;
        }
        if (trimmed.startsWith('[') && trimmed !== `[program:${cleanName}]`) {
          inSection = false;
        }
        if (!inSection) {
          continue;
        }

        if (trimmed.startsWith('command=')) config.command = trimmed.substring(8).trim();
        if (trimmed.startsWith('directory=')) config.directory = trimmed.substring(10).trim();
        if (trimmed.startsWith('user=')) config.user = trimmed.substring(5).trim();
        if (trimmed.startsWith('stdout_logfile=')) config.stdout_logfile = trimmed.substring(15).trim();
        if (trimmed.startsWith('stderr_logfile=')) config.stderr_logfile = trimmed.substring(15).trim();
      }
    }

    let pmStatus = 'stopped';
    if (state === 'RUNNING') pmStatus = 'online';
    else if (state === 'FATAL' || state === 'BACKOFF') pmStatus = 'errored';
    else if (state === 'STARTING') pmStatus = 'launching';

    return {
      name,
      pm_id: name,
      pm2_env: {
        status: pmStatus,
        pm_uptime: startTime,
        restart_time: 0,
        pm_exec_path: config.command || 'N/A',
        pm_cwd: config.directory || 'N/A',
        exec_interpreter: 'supervisor',
        instances: 1,
        node_version: 'N/A',
        pm_out_log_path: config.stdout_logfile || 'N/A',
        pm_err_log_path: config.stderr_logfile || 'N/A',
      },
      monit: {
        cpu,
        memory,
      },
    };
  }

  if (provider !== 'pm2') {
    throw new Error(`Provider ${provider} not supported`);
  }

  const result = await executeQuickCommand(serverId, `pm2 describe "${name}" --json`);
  if (result.error) {
    console.warn('Error fetching process details:', result.error);
    return null;
  }

  try {
    const list = JSON.parse(result.output || '[]');
    if (Array.isArray(list) && list.length > 0) {
      return list[0];
    }
    return null;
  } catch (error) {
    console.error('Failed to parse pm2 describe output:', error);
    return null;
  }
}
