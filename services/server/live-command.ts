'use server';

import { runCommandOnServer } from '@/services/server/ssh';
import { appendLiveSessionLog } from '@/services/saved-commands/saved-commands-service';
import { createServerLog, updateServerLog } from '@/services/logs/server';
import { getServerForRunner } from '@/services/server/server-runtime';
import {
  createLiveSession,
  getLiveSessionById,
  getLiveSessionHistory,
  updateLiveSession,
  updateLiveSessionHistory,
} from '@/services/live-sessions/data';

export interface AcmeDnsSessionState {
  kind: 'acme-dns';
  serverId: string;
  configName: string;
  domains: string[];
  dnsRecord: string;
  challenge: string;
  challengeFilePath: string;
  signalFilePath: string;
  logFilePath: string;
  pidFilePath: string;
  status: 'pending-dns' | 'ready-to-verify' | 'verifying' | 'completed' | 'failed';
  message?: string;
  updatedAt: string;
}

function isAcmeDnsSessionState(value: unknown): value is AcmeDnsSessionState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<AcmeDnsSessionState>;
  return candidate.kind === 'acme-dns' && typeof candidate.serverId === 'string' && typeof candidate.configName === 'string';
}

export async function initLiveSession(sessionId: string, serverId: string | undefined) {
  const session = await getLiveSessionById(sessionId);
  if (session) {
    return session;
  }

  let serverLogId: string | null = null;

  if (serverId) {
    const log = await createServerLog({
      serverId,
      command: `Live Session ${sessionId}`,
      commandName: 'Live Session (Active)',
      output: '',
      status: 'Running',
    });
    serverLogId = log.id;
  }

  return createLiveSession({
    id: sessionId,
    serverLogId,
    serverId: serverId ?? null,
  });
}

export async function endLiveSession(sessionId: string) {
  const session = await getLiveSessionById(sessionId);
  if (!session) {
    return;
  }

  if (session.serverLogId) {
    await updateServerLog(session.serverLogId, {
      status: 'Discontinued',
      commandName: 'Live Session (Ended)',
    });
  }

  await updateLiveSession(sessionId, { status: 'ended' });
}

export async function getAcmeDnsSession(sessionId: string): Promise<AcmeDnsSessionState | null> {
  const history = await getLiveSessionHistory(sessionId);
  return isAcmeDnsSessionState(history.acmeDns) ? history.acmeDns : null;
}

export async function setAcmeDnsSession(sessionId: string, state: AcmeDnsSessionState) {
  await updateLiveSessionHistory(sessionId, (history) => ({
    ...history,
    acmeDns: state,
  }));
}

export async function executeLiveCommand(sessionId: string, serverId: string | undefined, command: string) {
  let session = await getLiveSessionById(sessionId);

  if (!session) {
    session = await initLiveSession(sessionId, serverId);
  }

  const currentCwd = session.cwd || '~';
  const timestamp = new Date().toISOString();
  let output = '';
  let newCwd = currentCwd;

  if (!serverId) {
    const parts = command.trim().split(' ');
    const cmd = parts[0];
    const args = parts.slice(1);

    if (cmd === 'cd') {
      const target = args[0] || '~';
      if (target === '..') {
        const pathParts = currentCwd.split('/').filter(Boolean);
        pathParts.pop();
        newCwd = '/' + pathParts.join('/');
        if (newCwd === '//') newCwd = '/';
        if (newCwd === '') newCwd = '/';
      } else if (target === '~') {
        newCwd = '~';
      } else if (target.startsWith('/')) {
        newCwd = target;
      } else {
        newCwd = (currentCwd === '~' ? '/home/user' : currentCwd) + '/' + target;
      }
    } else if (cmd === 'ls') {
      output = 'file1.txt  file2.js  folder/';
    } else if (cmd === 'pwd') {
      output = currentCwd;
    } else if (cmd === 'echo') {
      output = args.join(' ');
    } else {
      output = `Command not found: ${cmd} (Mock Mode)`;
    }
  } else {
    try {
      const server = await getServerForRunner(serverId);
      if (!server || !server.username) {
        output = 'Error: Server not configured correctly for SSH.';
      } else {
        const connectionPrefix = currentCwd !== '~' ? `cd "${currentCwd}" && ` : '';
        const pwdMarker = '___PWD_MARKER___';
        const fullCommand = `export TERM=xterm-256color; ${connectionPrefix}${command}; echo "${pwdMarker}"; pwd`;
        const serverVariables = {
          'server.name': server.name,
          'server.publicIp': server.publicIp,
          'server.os': server.type || 'linux',
        };

        const result = await runCommandOnServer(
          server.publicIp,
          server.username,
          server.privateKey,
          fullCommand,
          undefined,
          undefined,
          true,
          serverVariables
        );

        const fullOutput = result.stdout + (result.stderr ? '\n' + result.stderr : '');
        const parts = fullOutput.split(pwdMarker);

        if (parts.length >= 2) {
          output = parts[0].trim();
          newCwd = parts[1].trim();
        } else {
          output = fullOutput;
        }

        if (result.code !== 0) {
          output += `\n(Exit code: ${result.code})`;
        }
      }
    } catch (error: any) {
      output = `Execution Error: ${error.message}`;
    }
  }

  if (session.serverLogId) {
    await appendLiveSessionLog(session.serverLogId, command, output, timestamp);
  }

  await updateLiveSession(sessionId, { cwd: newCwd });
  return { output, cwd: newCwd };
}
