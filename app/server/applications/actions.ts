'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { promisify } from 'util';
import { exec } from 'child_process';
import { readFile, unlink } from 'fs/promises';
import path from 'path';
import * as Git from '@/core/github';
import { executeCommand, executeQuickCommand } from '../commands/actions';
import {
  createApplication as createApplicationRecord,
  deleteApplication as deleteApplicationRecord,
  getApplicationById,
  getApplications as getApplicationsData,
  updateApplication as updateApplicationRecord,
} from '@/services/applications/data';
import {
  getApplicationStopCommand,
  prepareApplicationCreateData,
  prepareApplicationUpdateData,
  sanitizeStageName,
} from '@/services/applications/logic';
import type { Application, CreateApplicationData, UpdateApplicationData } from './types';
import { findApplicationProcess, type ServerProcess } from './status';
import { buildSupervisorServiceName, generateSupervisorServiceToken } from '@/services/applications/service-name';

const execAsync = promisify(exec);

export async function getApplications(): Promise<Application[]> {
  return getApplicationsData();
}

export async function getApplication(id: string): Promise<Application | null> {
  const application = await getApplicationById(id);

  if (!application) {
    return null;
  }

  if (application.information?.supervisorServiceName) {
    return application;
  }

  const supervisorServiceName = buildSupervisorServiceName(id, generateSupervisorServiceToken());

  return updateApplicationRecord(
    id,
    prepareApplicationUpdateData({
      information: {
        ...application.information,
        supervisorServiceName,
      },
    })
  );
}

export async function createApplication(appData: CreateApplicationData) {
  const application = await createApplicationRecord(prepareApplicationCreateData(appData));
  revalidatePath('/server/applications');
  return application.id;
}

export async function deleteApplication(id: string) {
  const app = await getApplication(id);
  if (app) {
    try {
      const stopCommand = getApplicationStopCommand(app);

      if (stopCommand) {
        const cookieStore = await cookies();
        const serverId = cookieStore.get('selected_server')?.value;
        if (serverId) {
          try {
            await executeCommand(serverId, stopCommand, `Stopping ${app.name}`, stopCommand);
          } catch (error) {
            console.warn('Failed to stop application before deletion:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error setting up stop command:', error);
    }
  }

  await deleteApplicationRecord(id);
  revalidatePath('/server/applications');
}

export async function updateApplication(id: string, data: UpdateApplicationData) {
  if (Object.keys(data).length === 0) {
    return;
  }

  await updateApplicationRecord(id, prepareApplicationUpdateData(data));
  revalidatePath('/server/applications');
  revalidatePath(`/server/applications/${id}`);
}

type SyncApplicationsWithServerResult = {
  applications: Application[];
  serverOnlyApplications: ServerProcess[];
};

export async function syncApplicationsWithServer(): Promise<SyncApplicationsWithServerResult> {
  const applications = await getApplicationsData();
  const supervisorProcesses = await getSupervisorProcesses();
  const normalizedSupervisorProcesses: ServerProcess[] = (Array.isArray(supervisorProcesses) ? supervisorProcesses : []).map((process) => ({
    ...process,
    source: 'supervisor',
  }));

  const matchedProcessNames = new Set<string>();
  let didUpdateAnyApplication = false;

  const syncedApplications = await Promise.all(
    applications.map(async (application) => {
      const matchedProcess = findApplicationProcess(
        application.id,
        normalizedSupervisorProcesses,
        application.information?.supervisorServiceName
      );

      if (matchedProcess) {
        matchedProcessNames.add(`${matchedProcess.source}:${matchedProcess.name}`);
      }

      const nextServerSync = matchedProcess
        ? {
            status: 'matched' as const,
            matchedProcessName: matchedProcess.name,
            matchedProcessState: matchedProcess.state,
            matchedProcessSource: matchedProcess.source,
          }
        : {
            status: 'missing_on_server' as const,
          };
      const nextSupervisorServiceName = matchedProcess?.name ?? application.information?.supervisorServiceName;

      const currentServerSync = application.information?.serverSync;
      const hasServerSyncChanged =
        currentServerSync?.status !== nextServerSync.status ||
        currentServerSync?.matchedProcessName !== nextServerSync.matchedProcessName ||
        currentServerSync?.matchedProcessState !== nextServerSync.matchedProcessState ||
        currentServerSync?.matchedProcessSource !== nextServerSync.matchedProcessSource ||
        application.information?.supervisorServiceName !== nextSupervisorServiceName;

      if (!hasServerSyncChanged) {
        return {
          ...application,
          information: {
            ...application.information,
            supervisorServiceName: nextSupervisorServiceName,
            serverSync: nextServerSync,
          },
        };
      }

      didUpdateAnyApplication = true;

      return updateApplicationRecord(
        application.id,
        prepareApplicationUpdateData({
          information: {
            ...application.information,
            supervisorServiceName: nextSupervisorServiceName,
            serverSync: nextServerSync,
          },
        })
      );
    })
  );

  if (didUpdateAnyApplication) {
    revalidatePath('/server/applications');
  }

  return {
    applications: syncedApplications,
    serverOnlyApplications: normalizedSupervisorProcesses.filter(
      (process) => !matchedProcessNames.has(`${process.source}:${process.name}`)
    ),
  };
}

export async function executeApplicationCommand(
  applicationId: string,
  command: string,
  commandName?: string
) {
  const app = await getApplication(applicationId);
  if (!app) throw new Error('Application not found');

  const cookieStore = await cookies();
  const serverId = cookieStore.get('selected_server')?.value;

  if (!serverId) {
    throw new Error('No server selected. Please select a server first.');
  }

  const formattedCommandName = commandName
    ? `${app.name} ${commandName}`
    : `${app.name} Custom Command`;

  const stageName = sanitizeStageName(commandName || 'custom_command');
  const statusFilePath = `${app.location}/.status`;
  const timestamp = new Date().toISOString();

  const updateStatusCommand = `
# Update or create .status file
STATUS_FILE="${statusFilePath}"
STAGE_NAME="${stageName}"
TIMESTAMP="${timestamp}"

mkdir -p "$(dirname "$STATUS_FILE")"

if [ -f "$STATUS_FILE" ]; then
    EXISTING_STATUS=$(cat "$STATUS_FILE")
else
    EXISTING_STATUS="[]"
fi

NEW_ENTRY="{\\"stage_name\\":\\"$STAGE_NAME\\",\\"status\\":\\"ongoing\\",\\"started_on\\":\\"$TIMESTAMP\\"}"

if command -v jq &> /dev/null; then
    echo "$EXISTING_STATUS" | jq \\
        --arg stage "$STAGE_NAME" \\
        --arg status "ongoing" \\
        --arg time "$TIMESTAMP" \\
        'map(if .stage_name == $stage then .status = $status | .started_on = $time else . end) |
         if any(.stage_name == $stage) then . else . + [{"stage_name": $stage, "status": $status, "started_on": $time}] end' \\
        > "$STATUS_FILE"
else
    echo "$EXISTING_STATUS" | sed 's/]$//' | sed 's/^\\\\[//' > /tmp/status_temp
    if [ -s /tmp/status_temp ]; then
        echo "[$NEW_ENTRY," >> "$STATUS_FILE.new"
        cat /tmp/status_temp >> "$STATUS_FILE.new"
        echo "]" >> "$STATUS_FILE.new"
    else
        echo "[$NEW_ENTRY]" > "$STATUS_FILE.new"
    fi
    mv "$STATUS_FILE.new" "$STATUS_FILE"
    rm -f /tmp/status_temp
fi

echo "-->>-->>${stageName}.starts<<--<<--"
${command}
COMMAND_EXIT_CODE=$?
echo "-->>-->>${stageName}.ends<<--<<--"

if [ $COMMAND_EXIT_CODE -eq 0 ]; then
    if command -v jq &> /dev/null; then
        TEMP_FILE=$(mktemp)
        cat "$STATUS_FILE" | jq \\
            --arg stage "$STAGE_NAME" \\
            'map(if .stage_name == $stage then .status = "completed" else . end)' \\
            > "$TEMP_FILE"
        mv "$TEMP_FILE" "$STATUS_FILE"
    fi
fi

exit $COMMAND_EXIT_CODE
`;

  return executeCommand(serverId, updateStatusCommand, formattedCommandName, command);
}

export async function generateRepositoryKeys() {
  const keyPath = `/tmp/key_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  try {
    await execAsync(`ssh-keygen -t ed25519 -C "neup.cloud-deploy" -f "${keyPath}" -N ""`);

    const privateKey = await readFile(keyPath, 'utf8');
    const publicKey = await readFile(`${keyPath}.pub`, 'utf8');

    await unlink(keyPath).catch(() => {});
    await unlink(`${keyPath}.pub`).catch(() => {});

    return { privateKey, publicKey };
  } catch (error) {
    console.error('Error generating keys:', error);
    await unlink(keyPath).catch(() => {});
    await unlink(`${keyPath}.pub`).catch(() => {});
    throw new Error('Failed to generate repository keys');
  }
}

export async function performGitOperation(
  applicationId: string,
  operation: 'clone' | 'pull' | 'pull-force' | 'reset-main'
) {
  const app = await getApplication(applicationId);
  if (!app) throw new Error('Application not found');

  const cookieStore = await cookies();
  const serverId = cookieStore.get('selected_server')?.value;
  if (!serverId) throw new Error('No server selected');

  let repoUrl = app.repository;
  if (!repoUrl) throw new Error('No repository configured');

  const location = app.location;
  const repoInfo = app.information?.repoInfo || {};
  const isPrivate = repoInfo.isPrivate;
  const privateKey = repoInfo.accessKey;

  if (isPrivate && privateKey && (repoUrl.startsWith('https://') || repoUrl.startsWith('http://'))) {
    try {
      if (repoUrl.includes('github.com')) {
        const url = new URL(repoUrl);
        const pathname = url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname;
        repoUrl = `git@github.com:${pathname}`;
      } else if (repoUrl.includes('gitlab.com')) {
        const url = new URL(repoUrl);
        const pathname = url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname;
        repoUrl = `git@gitlab.com:${pathname}`;
      }

      if (!repoUrl.endsWith('.git')) {
        repoUrl += '.git';
      }
    } catch (error) {
      console.warn('Failed to convert HTTPS URL to SSH, proceeding with original:', error);
    }
  }

  let command = '';
  let description = '';

  const wrapWithKey = (cmdGenerator: (keyPath: string) => string) => {
    if (!privateKey) return cmdGenerator('');

    return `
set -euo pipefail

CLEANUP_PATHS=""
cleanup() {
    for path in $CLEANUP_PATHS; do
        [ -e "$path" ] && rm -rf "$path"
    done
}
trap cleanup EXIT

KEY_PATH="$(mktemp)"
CLEANUP_PATHS="$CLEANUP_PATHS $KEY_PATH"

cat <<EOF > "$KEY_PATH"
${privateKey}
EOF
chmod 600 "$KEY_PATH"

${cmdGenerator('"$KEY_PATH"')}
`;
  };

  switch (operation) {
    case 'clone':
      description = 'Cloning Repository';
      command = isPrivate && privateKey
        ? wrapWithKey((keyPath) => Git.getPrivateCloneCommand(location, repoUrl, keyPath))
        : Git.getPublicCloneCommand(location, repoUrl);
      break;
    case 'pull':
      description = 'Pulling Repository';
      command = isPrivate && privateKey
        ? wrapWithKey((keyPath) => Git.getPrivatePullCommand(location, keyPath, 'main'))
        : Git.getPullCommand(location, 'main');
      break;
    case 'pull-force':
      description = 'Force Pulling Repository';
      command = isPrivate && privateKey
        ? wrapWithKey((keyPath) => Git.getPrivatePullForceCommand(location, keyPath, 'main'))
        : Git.getPullForceCommand(location, 'main');
      break;
    case 'reset-main':
      description = 'Resetting to Main';
      command = isPrivate && privateKey
        ? wrapWithKey((keyPath) => Git.getPrivateResetCommand(location, keyPath, 'origin/main'))
        : Git.getResetCommand(location, 'origin/main');
      break;
  }

  if (!command) throw new Error('Could not generate command');

  return executeCommand(serverId, command, `${app.name}: ${description}`, command);
}

export async function getRunningProcesses() {
  const cookieStore = await cookies();
  const serverId = cookieStore.get('selected_server')?.value;
  if (!serverId) throw new Error('No server selected');

  const delimiter = '---NEUP_CLOUD_SPLIT---';
  const command = `
        if command -v pm2 &> /dev/null; then
            pm2 jlist && echo "${delimiter}" && (if [ -s ~/.pm2/dump.pm2 ]; then cat ~/.pm2/dump.pm2; else echo "[]"; fi)
        else
            echo "[]${delimiter}[]"
        fi
    `;

  const result = await executeQuickCommand(serverId, command);

  if (result.error) {
    console.warn('Error fetching pm2 list:', result.error);
    return [];
  }

  try {
    const parts = (result.output || '').split(delimiter);
    const runningListRaw = parts[0]?.trim();
    const savedListRaw = parts[1]?.trim();

    const runningList = JSON.parse(runningListRaw || '[]');
    let savedList = [];

    try {
      savedList = JSON.parse(savedListRaw || '[]');
    } catch (error) {
      console.warn('Failed to parse saved list:', error);
    }

    const savedNames = new Set(savedList.map((process: any) => process.name));

    return runningList.map((process: any) => ({
      ...process,
      isPermanent: savedNames.has(process.name),
    }));
  } catch (error) {
    console.error('Failed to process pm2 output:', error);
    return [];
  }
}

export async function getSupervisorProcesses() {
  const cookieStore = await cookies();
  const serverId = cookieStore.get('selected_server')?.value;
  if (!serverId) throw new Error('No server selected');

  const command = `
    if command -v supervisorctl &> /dev/null; then 
        sudo supervisorctl status 2>/dev/null || true
    elif [ -f /usr/bin/supervisorctl ]; then
        sudo /usr/bin/supervisorctl status 2>/dev/null || true
    elif [ -f /usr/local/bin/supervisorctl ]; then
        sudo /usr/local/bin/supervisorctl status 2>/dev/null || true
    else
        echo "SUPERVISORCTL_NOT_FOUND"
    fi`;

  const result = await executeQuickCommand(serverId, command);

  if (result.error) {
    console.warn('Error fetching supervisor list:', result.error);
    return [];
  }

  try {
    const output = (result.output || '').trim();
    if (!output || output === 'SUPERVISORCTL_NOT_FOUND') return [];

    const lines = output.split('\n');
    const processes = [];

    for (const line of lines) {
      if (!line) continue;

      const match = line.match(/^(\S+)\s+(\S+)(?:\s+(.*))?$/);
      if (!match) continue;

      const name = match[1];
      const state = match[2];
      const description = match[3] || '';

      let pid = null;
      let uptime = null;

      const pidMatch = description.match(/pid (\d+)/);
      if (pidMatch) {
        pid = parseInt(pidMatch[1], 10);
      }

      const uptimeMatch = description.match(/uptime (\S+)/);
      if (uptimeMatch) {
        uptime = uptimeMatch[1];
      }

      processes.push({
        name,
        state,
        description,
        pid,
        uptime,
        source: 'supervisor',
        isPermanent: true,
      });
    }

    return processes;
  } catch (error) {
    console.error('Failed to process supervisor output:', error);
    return [];
  }
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

export async function stopSupervisorOnlyProcess(name: string) {
  const cookieStore = await cookies();
  const serverId = cookieStore.get('selected_server')?.value;
  if (!serverId) throw new Error('No server selected');

  const result = await executeQuickCommand(serverId, `sudo supervisorctl stop '${name}' || true`);
  if (result.error) {
    throw new Error(result.error);
  }

  revalidatePath('/server/applications');
  revalidatePath(`/server/applications/${encodeURIComponent(`supervisor_${name}`)}`);
  return { success: true, output: result.output };
}

export async function deleteSupervisorOnlyProcess(name: string) {
  const cookieStore = await cookies();
  const serverId = cookieStore.get('selected_server')?.value;
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

export async function getProcessDetails(provider: string, name: string) {
  const cookieStore = await cookies();
  const serverId = cookieStore.get('selected_server')?.value;
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

export async function deployConfiguration(applicationId: string) {
  const app = await getApplication(applicationId);
  if (!app) throw new Error('Application not found');

  const cookieStore = await cookies();
  const serverId = cookieStore.get('selected_server')?.value;
  if (!serverId) throw new Error('No server selected. Please select a server first.');

  const location = app.location;
  if (!location) throw new Error('Application location not defined');

  let envContent = '';
  if (app.environments) {
    envContent = Object.entries(app.environments)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
  }

  const envCommand = `cat <<'EOF' > "${location}/.env"
${envContent}
EOF
`;

  await executeCommand(serverId, envCommand, `Deploying .env for ${app.name}`, envCommand);

  if (app.files && Object.keys(app.files).length > 0) {
    let fileOpsScript = 'echo "Starting Custom File Deployment..."\n';

    for (const [filePath, content] of Object.entries(app.files)) {
      const delimiter = `EOF_${Math.random().toString(36).substring(7).toUpperCase()}`;
      const targetPath = `${location}/${filePath}`;

      fileOpsScript += `
mkdir -p "$(dirname "${targetPath}")"
cat <<'${delimiter}' > "${targetPath}"
${content}
${delimiter}
echo "Deployed ${filePath}"
`;
    }

    await executeCommand(
      serverId,
      fileOpsScript,
      `Deploying ${Object.keys(app.files).length} custom files for ${app.name}`,
      fileOpsScript
    );
  }

  revalidatePath(`/server/applications/${applicationId}`);
  return { success: true };
}
