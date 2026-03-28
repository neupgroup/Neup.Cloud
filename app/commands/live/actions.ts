'use server';

import { cookies } from 'next/headers';
import { getServerForRunner } from '@/app/servers/actions';
import { runCommandOnServer } from '@/services/ssh';
import { revalidatePath } from 'next/cache';
import { createRecordId, queryAppDb } from '@/lib/app-db';

type LiveSessionRow = {
    id: string;
    cwd: string;
    status: string;
    serverLogId: string | null;
    serverId: string | null;
};

/**
 * Ensures a live session document exists and initializes a server log for it.
 * Also refreshes the session cookie.
 */
export async function initLiveSession(sessionId: string, serverId: string | undefined) {
    const cookieStore = await cookies();
    cookieStore.set('live_session_id', sessionId, {
        maxAge: 15 * 60, // 15 minutes
        path: '/',
    });

    const sessionResult = await queryAppDb<LiveSessionRow>(`
      SELECT id, cwd, status, "serverLogId", "serverId"
      FROM live_sessions
      WHERE id = $1
      LIMIT 1
    `, [sessionId]);

    if (sessionResult.rows.length === 0) {
        let serverLogId = null;

        if (serverId) {
            serverLogId = createRecordId();
            await queryAppDb(`
              INSERT INTO server_logs (
                id,
                "serverId",
                command,
                "commandName",
                output,
                status,
                "runAt"
              )
              VALUES ($1, $2, $3, $4, $5, $6, NOW())
            `, [
              serverLogId,
              serverId,
              `Live Session ${sessionId}`,
              'Live Session (Active)',
              '',
              'Running',
            ]);
            revalidatePath(`/servers/${serverId}`);
        }

        await queryAppDb(`
          INSERT INTO live_sessions (
            id,
            "createdAt",
            cwd,
            status,
            history,
            "serverLogId",
            "serverId"
          )
          VALUES ($1, NOW(), '~', 'active', '[]'::jsonb, $2, $3)
        `, [sessionId, serverLogId, serverId ?? null]);
    }
}

/**
 * Marks the live session as 'Discontinued' in the server logs.
 */
export async function endLiveSession(sessionId: string, serverId: string | undefined) {
    const sessionResult = await queryAppDb<LiveSessionRow>(`
      SELECT id, cwd, status, "serverLogId", "serverId"
      FROM live_sessions
      WHERE id = $1
      LIMIT 1
    `, [sessionId]);

    const session = sessionResult.rows[0];
    if (!session) return;

    if (session.serverLogId) {
        await queryAppDb(`
          UPDATE server_logs
          SET status = 'Discontinued', "commandName" = 'Live Session (Ended)'
          WHERE id = $1
        `, [session.serverLogId]);
        if (serverId) {
            revalidatePath(`/servers/${serverId}`);
        }
    }

    await queryAppDb(`
      UPDATE live_sessions
      SET status = 'ended'
      WHERE id = $1
    `, [sessionId]);
}

/**
 * Executes a command in the context of the live session.
 * Appends output to the Server Log immediately.
 */
export async function executeLiveCommand(sessionId: string, serverId: string | undefined, command: string) {
    let sessionResult = await queryAppDb<LiveSessionRow>(`
      SELECT id, cwd, status, "serverLogId", "serverId"
      FROM live_sessions
      WHERE id = $1
      LIMIT 1
    `, [sessionId]);

    if (sessionResult.rows.length === 0) {
        await initLiveSession(sessionId, serverId);
        sessionResult = await queryAppDb<LiveSessionRow>(`
          SELECT id, cwd, status, "serverLogId", "serverId"
          FROM live_sessions
          WHERE id = $1
          LIMIT 1
        `, [sessionId]);
    }

    const session = sessionResult.rows[0];
    let currentCwd = session?.cwd || '~';
    const serverLogId = session?.serverLogId;

    let output = '';
    let newCwd = currentCwd;
    const timestamp = new Date().toISOString();

    if (!serverId) {
        // === MOCK MODE ===
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
            output = '';
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
        // === REAL SSH MODE ===
        try {
            const server = await getServerForRunner(serverId);
            if (!server || !server.username || !server.privateKey) {
                output = 'Error: Server not configured correctly for SSH.';
            } else {
                let connectionCmd = '';
                if (currentCwd !== '~') {
                    connectionCmd = `cd "${currentCwd}" && `;
                }

                const pwdMarker = '___PWD_MARKER___';
                const fullCommand = `export TERM=xterm-256color; ${connectionCmd}${command}; echo "${pwdMarker}"; pwd`;

                // Add server context variables
                const serverVariables = {
                    'server.name': server.name,
                    'server.publicIp': server.publicIp,
                    'server.os': server.type || 'linux'
                };

                const result = await runCommandOnServer(
                    server.publicIp,
                    server.username,
                    server.privateKey,
                    fullCommand,
                    undefined,
                    undefined,
                    true, // skipSwap - Don't use swap space for live terminal sessions (better performance and responsiveness)
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
        } catch (e: any) {
            output = `Execution Error: ${e.message}`;
        }
    }

    if (serverLogId) {
        try {
            const logResult = await queryAppDb<{ output: string | null }>(`
              SELECT output
              FROM server_logs
              WHERE id = $1
              LIMIT 1
            `, [serverLogId]);

            const currentOutput = logResult.rows[0]?.output || '';
            const newEntry = `\n${timestamp} [COMMAND]: ${command}\n${timestamp} [OUTPUT]: ${output}`;
            await queryAppDb(`
              UPDATE server_logs
              SET output = $2
              WHERE id = $1
            `, [serverLogId, currentOutput + newEntry]);
        } catch (err) {
            console.error("Failed to append to log:", err);
        }
    }

    await queryAppDb(`
      UPDATE live_sessions
      SET cwd = $2
      WHERE id = $1
    `, [sessionId, newCwd]);

    return { output, cwd: newCwd };
}
