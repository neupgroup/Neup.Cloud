'use server';

import { exec as rawExec } from 'child_process';
import { readFile, unlink } from 'fs/promises';
import { promisify } from 'util';

import * as Git from '@/services/core/github';
import { executeCommand } from '@/services/saved-commands/saved-commands-service';

import { getApplication } from './crud';

const execAsync = promisify(rawExec);

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
  selectedServerId: string | null | undefined,
  operation: 'clone' | 'pull' | 'pull-force' | 'reset-main'
) {
  const app = await getApplication(applicationId);
  if (!app) throw new Error('Application not found');

  const serverId = selectedServerId?.trim() || null;
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

  return executeCommand(serverId, command, `${app.name}: ${description}`, command, `application:${applicationId}`);
}
