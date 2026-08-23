'use server';

import { exec as rawExec } from 'child_process';
import { constants, privateDecrypt } from 'node:crypto';
import { readFile, unlink } from 'fs/promises';
import path from 'path';
import { promisify } from 'util';

import * as Git from '@/services/core/github';
import logica from '@/logica';
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
  operation: 'clone' | 'pull' | 'pull-force' | 'reset-main' | 'push'
) {
  const app = await getApplication(applicationId);
  if (!app) throw new Error('Application not found');

  const serverId = selectedServerId?.trim() || null;
  if (!serverId) throw new Error('No server selected');

  let repoUrl = app.repository;
  if (!repoUrl) throw new Error('No repository configured');

  const location = app.location;
  const repoInfo = app.information?.repoInfo || {};
  const isPrivate = repoInfo.isPrivate === true;
  const linkedGithubToken = isPrivate ? await resolveLinkedGithubToken(repoUrl) : null;
  const normalizedGithubRepoUrl = linkedGithubToken ? normalizeGithubRepositoryUrl(repoUrl) : null;

  let command = '';
  let description = '';
  let displayCommand = '';
  const wrapWithGithubToken = (commandBody: string, token: string) => `
set -euo pipefail

export GITHUB_AUTH_HEADER='Authorization: Basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}'

${commandBody}
`;

  switch (operation) {
    case 'clone':
      description = 'Cloning Repository';
      if (normalizedGithubRepoUrl && linkedGithubToken) {
        displayCommand = Git.getAuthenticatedCloneCommand(location, normalizedGithubRepoUrl);
        command = wrapWithGithubToken(displayCommand, linkedGithubToken);
      } else {
        command = Git.getPublicCloneCommand(location, repoUrl);
        displayCommand = command;
      }
      break;
    case 'pull':
      description = 'Pulling Repository';
      if (normalizedGithubRepoUrl && linkedGithubToken) {
        displayCommand = Git.getAuthenticatedPullCommand(location, normalizedGithubRepoUrl, 'main');
        command = wrapWithGithubToken(displayCommand, linkedGithubToken);
      } else {
        command = Git.getPullCommand(location, 'main');
        displayCommand = command;
      }
      break;
    case 'pull-force':
      description = 'Force Pulling Repository';
      if (normalizedGithubRepoUrl && linkedGithubToken) {
        displayCommand = Git.getAuthenticatedPullForceCommand(location, normalizedGithubRepoUrl, 'main');
        command = wrapWithGithubToken(displayCommand, linkedGithubToken);
      } else {
        command = Git.getPullForceCommand(location, 'main');
        displayCommand = command;
      }
      break;
    case 'reset-main':
      description = 'Resetting to Main';
      if (normalizedGithubRepoUrl && linkedGithubToken) {
        displayCommand = Git.getAuthenticatedResetCommand(location, normalizedGithubRepoUrl, 'main');
        command = wrapWithGithubToken(displayCommand, linkedGithubToken);
      } else {
        command = Git.getResetCommand(location, 'origin/main');
        displayCommand = command;
      }
      break;
    case 'push':
      description = 'Pushing Changes';
      if (!normalizedGithubRepoUrl || !linkedGithubToken) {
        throw new Error('Private Git pushes require a linked GitHub account.');
      }
      displayCommand = Git.getAuthenticatedPushCommand(location, normalizedGithubRepoUrl, 'main');
      command = wrapWithGithubToken(displayCommand, linkedGithubToken);
      break;
  }

  if (!command) throw new Error('Could not generate command');

  return executeCommand(serverId, command, `${app.name}: ${description}`, displayCommand || command, `application:${applicationId}`);
}

function normalizeGithubRepositoryUrl(repoUrl: string): string {
  const trimmedRepoUrl = repoUrl.trim();

  if (!trimmedRepoUrl) {
    throw new Error('Repository URL is required for private GitHub operations.');
  }

  if (trimmedRepoUrl.startsWith('git@github.com:')) {
    const repositoryPath = trimmedRepoUrl.slice('git@github.com:'.length);
    return `https://github.com/${ensureGitSuffix(repositoryPath)}`;
  }

  if (trimmedRepoUrl.startsWith('ssh://git@github.com/')) {
    const repositoryPath = trimmedRepoUrl.slice('ssh://git@github.com/'.length);
    return `https://github.com/${ensureGitSuffix(repositoryPath)}`;
  }

  const parsedUrl = new URL(trimmedRepoUrl);
  if (parsedUrl.hostname !== 'github.com') {
    throw new Error('Private repository sync currently supports GitHub repositories only.');
  }

  return `https://github.com/${ensureGitSuffix(parsedUrl.pathname.replace(/^\/+/, ''))}`;
}

function ensureGitSuffix(repositoryPath: string): string {
  return repositoryPath.endsWith('.git') ? repositoryPath : `${repositoryPath}.git`;
}

async function resolveLinkedGithubToken(repoUrl: string): Promise<string> {
  if (!repoUrl.includes('github.com') && !repoUrl.startsWith('git@github.com:') && !repoUrl.startsWith('ssh://git@github.com/')) {
    throw new Error('Private repository sync currently supports GitHub repositories only.');
  }

  const linkedGithub = await logica.account.linked.github.get();
  if (!linkedGithub.ok || !linkedGithub.body?.success || !linkedGithub.body.token) {
    throw new Error(linkedGithub.body?.error_description || 'No linked GitHub account token was found for the current account.');
  }

  return decryptLinkedGithubToken(linkedGithub.body.token);
}

async function decryptLinkedGithubToken(encryptedToken: string): Promise<string> {
  const privateKeyPath = path.join(process.cwd(), 'keys/communication/github/private.pem');
  const privateKeyPem = await readFile(privateKeyPath, 'utf8');
  const encryptedBuffer = decodeEncryptedToken(encryptedToken);

  const attempts: Array<Parameters<typeof privateDecrypt>[0]> = [
    {
      key: privateKeyPem,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    {
      key: privateKeyPem,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
    },
    {
      key: privateKeyPem,
      padding: constants.RSA_PKCS1_PADDING,
    },
  ];

  for (const options of attempts) {
    try {
      const plaintext = privateDecrypt(options, encryptedBuffer).toString('utf8').trim();
      const parsedToken = extractGithubToken(plaintext);
      if (parsedToken) return parsedToken;
    } catch {
      // Try the next supported padding/hash combination.
    }
  }

  throw new Error('Could not decrypt the linked GitHub token with keys/communication/github/private.pem.');
}

function decodeEncryptedToken(encryptedToken: string): Buffer {
  const trimmedToken = encryptedToken.trim();
  const normalizedBase64 = trimmedToken.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalizedBase64.length % 4 === 0 ? '' : '='.repeat(4 - (normalizedBase64.length % 4));
  return Buffer.from(`${normalizedBase64}${padding}`, 'base64');
}

function extractGithubToken(value: string): string | null {
  if (!value) return null;

  if (!value.startsWith('{')) {
    return value;
  }

  try {
    const parsed = JSON.parse(value) as { token?: string; accessToken?: string };
    return parsed.accessToken?.trim() || parsed.token?.trim() || null;
  } catch {
    return value;
  }
}
