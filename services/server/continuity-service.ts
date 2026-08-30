/*
::neup.documentation::server-continuity-service
::title Server Continuity Service

Tmux-backed continuity terminal service functions for remote servers.

::public

Use `listContinuitySessions()` to show open continuity terminals for a server.

Use `createContinuitySession()` to create a system-generated tmux session and `sendContinuityCommand()` to write commands into it.

Use `getContinuitySessionSnapshot()` to render the current pane contents and `terminateContinuitySession()` to close a session.

::public end

::private

Continuity sessions are namespaced with the `continuity_` prefix and run over the existing SSH service on the selected server.

The service captures terminal output from tmux panes instead of holding a separate terminal transcript in the application database.

::private end

::end
*/

'use server';

import { stringUuid } from '#/core/data/uuid';
import { createServerLog } from '@/services/logs/server';
import { getServerForRunner } from '@/services/server/server-runtime';
import { runCommandOnServer } from '@/services/server/ssh';

const CONTINUITY_PREFIX = 'continuity_';
const SNAPSHOT_LINE_COUNT = 200;
const CONTINUITY_SESSION_SEPARATOR = '__NEUP_CONTINUITY_FIELD__';
const CONTINUITY_SESSION_ID_PATTERN = /^continuity_[A-Za-z0-9_.]+$/u;
const CONTINUITY_NANO_ERROR = 'Please use file manager, Nano does not works on continuity terminal.';
const CONTINUITY_CLEAR_ERROR = 'Clearing the continuity terminal is not allowed.';

export type ContinuitySession = {
  id: string;
  windows: number;
  attachedClients: number;
  createdAtEpoch: number | null;
};

export type ContinuitySessionSnapshot = {
  exists: boolean;
  sessionId: string;
  cwd: string;
  content: string;
};

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

function decodeContinuitySessionId(value: string) {
  let decoded = value.trim();

  for (let index = 0; index < 2; index += 1) {
    try {
      const nextDecoded = decodeURIComponent(decoded);
      if (nextDecoded === decoded) {
        break;
      }

      decoded = nextDecoded.trim();
    } catch {
      break;
    }
  }

  return decoded.split(/\\t|\t/u, 1)[0]?.trim() ?? '';
}

async function runContinuityCommand(serverId: string, command: string) {
  if (!serverId?.trim()) {
    throw new Error('A selected server is required.');
  }

  const server = await getServerForRunner(serverId);
  if (!server) {
    throw new Error('Server not found.');
  }

  if (!server.username) {
    throw new Error('Server is missing SSH credentials.');
  }

  const result = await runCommandOnServer(
    server.publicIp,
    server.username,
    server.privateKey,
    command,
    undefined,
    undefined,
    true,
    {}
  );

  return result;
}

function assertValidContinuitySessionId(sessionId: string) {
  const candidate = decodeContinuitySessionId(sessionId);
  if (!candidate.startsWith(CONTINUITY_PREFIX)) {
    throw new Error('Invalid continuity session ID.');
  }

  if (!CONTINUITY_SESSION_ID_PATTERN.test(candidate)) {
    throw new Error('Continuity session ID contains unsupported characters.');
  }

  return candidate;
}

function createMissingContinuitySnapshot(sessionId: string): ContinuitySessionSnapshot {
  return {
    exists: false,
    sessionId: decodeContinuitySessionId(sessionId),
    cwd: '~',
    content: '',
  };
}

function parseContinuitySessions(stdout: string) {
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [rawId, windowsValue, attachedValue, createdAtValue] = line.includes(CONTINUITY_SESSION_SEPARATOR)
        ? line.split(CONTINUITY_SESSION_SEPARATOR)
        : line.split(/\\t|\t/u);
      const id = rawId?.trim() ?? '';
      const windows = Number.parseInt(windowsValue ?? '0', 10);
      const attachedClients = Number.parseInt(attachedValue ?? '0', 10);
      const createdAtEpoch = Number.parseInt(createdAtValue ?? '', 10);

      return {
        id,
        windows: Number.isFinite(windows) ? windows : 0,
        attachedClients: Number.isFinite(attachedClients) ? attachedClients : 0,
        createdAtEpoch: Number.isFinite(createdAtEpoch) ? createdAtEpoch : null,
      } satisfies ContinuitySession;
    })
    .filter((session) => session.id.startsWith(CONTINUITY_PREFIX))
    .filter((session) => CONTINUITY_SESSION_ID_PATTERN.test(session.id))
    .sort((left, right) => {
      const leftCreated = left.createdAtEpoch ?? 0;
      const rightCreated = right.createdAtEpoch ?? 0;
      return rightCreated - leftCreated;
    });
}

export async function listContinuitySessions(serverId: string): Promise<ContinuitySession[]> {
  const result = await runContinuityCommand(
    serverId,
    [
      'if ! command -v tmux >/dev/null 2>&1; then',
      '  echo "__NEUP_CONTINUITY_TMUX_MISSING__";',
      '  exit 0;',
      'fi',
      `tmux list-sessions -F '#{session_name}${CONTINUITY_SESSION_SEPARATOR}#{session_windows}${CONTINUITY_SESSION_SEPARATOR}#{session_attached}${CONTINUITY_SESSION_SEPARATOR}#{session_created}' 2>/dev/null || true`,
    ].join('\n')
  );

  if (result.stdout.includes('__NEUP_CONTINUITY_TMUX_MISSING__')) {
    throw new Error('tmux is not installed on the selected server.');
  }

  return parseContinuitySessions(result.stdout);
}

export async function createContinuitySession(serverId: string) {
  const sessionId = `${CONTINUITY_PREFIX}${stringUuid().replace(/-/g, '').slice(0, 16)}`;
  const quotedSessionId = shellQuote(sessionId);

  const result = await runContinuityCommand(
    serverId,
    [
      'if ! command -v tmux >/dev/null 2>&1; then',
      '  echo "__NEUP_CONTINUITY_TMUX_MISSING__";',
      '  exit 0;',
      'fi',
      `tmux new-session -d -s ${quotedSessionId} -c "$HOME"`,
    ].join('\n')
  );

  if (result.stdout.includes('__NEUP_CONTINUITY_TMUX_MISSING__')) {
    throw new Error('tmux is not installed on the selected server.');
  }

  if (result.code !== 0) {
    throw new Error(result.stderr || 'Failed to create the continuity session.');
  }

  return { sessionId };
}

export async function getContinuitySessionSnapshot(
  serverId: string,
  sessionId: string,
  lineCount = SNAPSHOT_LINE_COUNT
): Promise<ContinuitySessionSnapshot> {
  let safeSessionId: string;
  try {
    safeSessionId = assertValidContinuitySessionId(sessionId);
  } catch {
    return createMissingContinuitySnapshot(sessionId);
  }

  const safeLineCount = Number.isFinite(lineCount) ? Math.max(20, Math.min(1000, Math.floor(lineCount))) : SNAPSHOT_LINE_COUNT;
  const quotedSessionId = shellQuote(safeSessionId);

  const result = await runContinuityCommand(
    serverId,
    [
      'if ! command -v tmux >/dev/null 2>&1; then',
      '  echo "__NEUP_CONTINUITY_TMUX_MISSING__";',
      '  exit 0;',
      'fi',
      `if ! tmux has-session -t ${quotedSessionId} 2>/dev/null; then`,
      '  echo "__NEUP_CONTINUITY_MISSING__";',
      '  exit 0;',
      'fi',
      `echo "__NEUP_CONTINUITY_CWD__"`,
      `tmux display-message -p -t ${quotedSessionId} '#{pane_current_path}'`,
      `echo "__NEUP_CONTINUITY_CONTENT__"`,
      `tmux capture-pane -p -t ${quotedSessionId} -S -${safeLineCount}`,
    ].join('\n')
  );

  if (result.stdout.includes('__NEUP_CONTINUITY_TMUX_MISSING__')) {
    throw new Error('tmux is not installed on the selected server.');
  }

  if (result.stdout.includes('__NEUP_CONTINUITY_MISSING__')) {
    return {
      exists: false,
      sessionId: safeSessionId,
      cwd: '~',
      content: '',
    };
  }

  const cwdMarker = '__NEUP_CONTINUITY_CWD__\n';
  const contentMarker = '\n__NEUP_CONTINUITY_CONTENT__\n';
  const markerIndex = result.stdout.indexOf(cwdMarker);
  const contentIndex = result.stdout.indexOf(contentMarker);

  if (markerIndex === -1 || contentIndex === -1) {
    return {
      exists: true,
      sessionId: safeSessionId,
      cwd: '~',
      content: result.stdout.trim(),
    };
  }

  const cwd = result.stdout.slice(markerIndex + cwdMarker.length, contentIndex).trim() || '~';
  const content = result.stdout.slice(contentIndex + contentMarker.length).replace(/\s+$/, '');

  return {
    exists: true,
    sessionId: safeSessionId,
    cwd,
    content,
  };
}

export async function sendContinuityCommand(serverId: string, sessionId: string, command: string) {
  const safeSessionId = assertValidContinuitySessionId(sessionId);
  const trimmedCommand = command.replace(/\r?\n/g, '\n').trimEnd();
  if (!trimmedCommand.trim()) {
    return getContinuitySessionSnapshot(serverId, safeSessionId);
  }

  // Interactive terminal editors cannot be rendered or controlled reliably by
  // the snapshot-based continuity terminal. Keep this policy server-side so
  // every continuity client follows the same restriction.
  if (/(?:^|[;&|]\s*)(?:sudo\s+)?nano(?:\s|$)/mu.test(trimmedCommand)) {
    throw new Error(CONTINUITY_NANO_ERROR);
  }

  if (/(?:^|[;&|]\s*)(?:(?:sudo\s+)?(?:clear|reset)|(?:sudo\s+)?tput\s+clear)(?:\s|$)/mu.test(trimmedCommand)) {
    throw new Error(CONTINUITY_CLEAR_ERROR);
  }

  const quotedSessionId = shellQuote(safeSessionId);
  const quotedCommand = shellQuote(trimmedCommand);

  const result = await runContinuityCommand(
    serverId,
    [
      'if ! command -v tmux >/dev/null 2>&1; then',
      '  echo "__NEUP_CONTINUITY_TMUX_MISSING__";',
      '  exit 0;',
      'fi',
      `if ! tmux has-session -t ${quotedSessionId} 2>/dev/null; then`,
      '  echo "__NEUP_CONTINUITY_MISSING__";',
      '  exit 0;',
      'fi',
      `tmux send-keys -t ${quotedSessionId} -l ${quotedCommand}`,
      `tmux send-keys -t ${quotedSessionId} Enter`,
    ].join('\n')
  );

  if (result.stdout.includes('__NEUP_CONTINUITY_TMUX_MISSING__')) {
    throw new Error('tmux is not installed on the selected server.');
  }

  if (result.stdout.includes('__NEUP_CONTINUITY_MISSING__')) {
    return {
      exists: false,
      sessionId: safeSessionId,
      cwd: '~',
      content: '',
    } satisfies ContinuitySessionSnapshot;
  }

  if (result.code !== 0) {
    throw new Error(result.stderr || 'Failed to send the command to the continuity session.');
  }

  await new Promise((resolve) => setTimeout(resolve, 150));
  return getContinuitySessionSnapshot(serverId, safeSessionId);
}

export async function sendContinuityEnter(serverId: string, sessionId: string) {
  const safeSessionId = assertValidContinuitySessionId(sessionId);
  const quotedSessionId = shellQuote(safeSessionId);

  const result = await runContinuityCommand(
    serverId,
    [
      'if ! command -v tmux >/dev/null 2>&1; then',
      '  echo "__NEUP_CONTINUITY_TMUX_MISSING__";',
      '  exit 0;',
      'fi',
      `if ! tmux has-session -t ${quotedSessionId} 2>/dev/null; then`,
      '  echo "__NEUP_CONTINUITY_MISSING__";',
      '  exit 0;',
      'fi',
      `tmux send-keys -t ${quotedSessionId} Enter`,
    ].join('\n')
  );

  if (result.stdout.includes('__NEUP_CONTINUITY_TMUX_MISSING__')) {
    throw new Error('tmux is not installed on the selected server.');
  }

  if (result.stdout.includes('__NEUP_CONTINUITY_MISSING__')) {
    return {
      exists: false,
      sessionId: safeSessionId,
      cwd: '~',
      content: '',
    } satisfies ContinuitySessionSnapshot;
  }

  if (result.code !== 0) {
    throw new Error(result.stderr || 'Failed to send Enter to the continuity session.');
  }

  await new Promise((resolve) => setTimeout(resolve, 150));
  return getContinuitySessionSnapshot(serverId, safeSessionId);
}

export async function terminateContinuitySession(serverId: string, sessionId: string) {
  const safeSessionId = assertValidContinuitySessionId(sessionId);
  const quotedSessionId = shellQuote(safeSessionId);
  const snapshot = await getContinuitySessionSnapshot(serverId, safeSessionId, 1000);

  const result = await runContinuityCommand(
    serverId,
    [
      'if ! command -v tmux >/dev/null 2>&1; then',
      '  echo "__NEUP_CONTINUITY_TMUX_MISSING__";',
      '  exit 0;',
      'fi',
      `tmux kill-session -t ${quotedSessionId} 2>/dev/null || true`,
    ].join('\n')
  );

  if (result.stdout.includes('__NEUP_CONTINUITY_TMUX_MISSING__')) {
    throw new Error('tmux is not installed on the selected server.');
  }

  if (snapshot.exists) {
    await createServerLog({
      serverId,
      command: `tmux attach -t ${safeSessionId}`,
      commandName: `Continuity Terminal ${safeSessionId}`,
      output: snapshot.content || `Session ${safeSessionId} ended without captured output.`,
      status: 'Success',
      source: 'commands:continuity',
    });
  }

  return { success: true };
}
