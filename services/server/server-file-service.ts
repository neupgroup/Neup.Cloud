'use server';

import { revalidatePath } from 'next/cache';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { getCommandLog } from '@/services/logs/command-log';
import { runCustomCommandOnServer as runCustomCommandOnServerLogic } from '@/services/server/server-runtime';
import { runCommandOnServer, uploadFileToServer } from '@/services/server/ssh';
import { getServerForRunner } from '@/services/server/server-service';
import { getServerSshPassphrase } from '@/services/server/server-metadata';
import type { FileOrFolder, FileSearchResult } from '@/services/server/server-file-types';

export async function runCustomCommandOnServer(serverId: string, command: string) {
  const result = await runCustomCommandOnServerLogic(serverId, command);
  revalidatePath(`/servers/${serverId}`);
  return result;
}

export async function rebootServer(serverId: string) {
  return runCustomCommandOnServer(serverId, 'sudo reboot');
}

export async function getServerLogs(serverId: string) {
  return getCommandLog({ serverId });
}

function parseLsOutput(output: string): FileOrFolder[] {
  if (!output) return [];
  const lines = output.trim().split('\n');

  return lines
    .slice(1)
    .map((line): FileOrFolder | null => {
      const parts = line.split(/\s+/);
      if (parts.length < 9) return null;

      const permissions = parts[0];
      const type = permissions.startsWith('d')
        ? 'directory'
        : permissions.startsWith('l')
          ? 'symlink'
          : 'file';
      const size = parseInt(parts[4], 10);
      const lastModified = `${parts[5]} ${parts[6]} ${parts[7]}`;

      const nameIndex = 8;
      let name = parts.slice(nameIndex).join(' ');
      let linkTarget: string | undefined;

      if (type === 'symlink') {
        const arrowIndex = name.indexOf(' -> ');
        if (arrowIndex !== -1) {
          linkTarget = name.substring(arrowIndex + 4);
          name = name.substring(0, arrowIndex);
        }
      }

      return {
        name,
        type,
        size,
        lastModified,
        permissions,
        linkTarget,
      };
    })
    .filter((item): item is FileOrFolder => item !== null);
}

export async function browseDirectory(
  serverId: string,
  targetPath: string,
  rootMode = false
): Promise<{ files: FileOrFolder[]; error?: string }> {
  const server = await getServerForRunner(serverId);
  if (!server) {
    return { files: [], error: 'Server not found.' };
  }
  if (!server.username || !server.privateKey) {
    return { files: [], error: 'No username or private key configured for this server.' };
  }

  const sshPassphrase = getServerSshPassphrase(server.moreDetails);

  try {
    const safePath = targetPath.endsWith('/') ? targetPath : `${targetPath}/`;
    const command = rootMode
      ? `sudo ls -lA --full-time "${safePath}"`
      : `ls -lA --full-time "${safePath}"`;
    const result = await runCommandOnServer(
      server.publicIp,
      server.username,
      server.privateKey,
      command,
      undefined,
      undefined,
      true,
      {},
      sshPassphrase ?? undefined
    );

    if (result.code !== 0) {
      return {
        files: [],
        error: result.stderr || `Failed to list directory contents. Exit code: ${result.code}`,
      };
    }

    return { files: parseLsOutput(result.stdout) };
  } catch (error: any) {
    return { files: [], error: `Failed to browse directory: ${error.message}` };
  }
}

export async function isDirectory(serverId: string, targetPath: string, rootMode = false): Promise<boolean> {
  const server = await getServerForRunner(serverId);
  if (!server || !server.username || !server.privateKey) {
    return false;
  }

  const sshPassphrase = getServerSshPassphrase(server.moreDetails);

  try {
    const command = rootMode ? `sudo test -d "${targetPath}"` : `test -d "${targetPath}"`;
    const result = await runCommandOnServer(
      server.publicIp,
      server.username,
      server.privateKey,
      command,
      undefined,
      undefined,
      true,
      {},
      sshPassphrase ?? undefined
    );
    return result.code === 0;
  } catch {
    return false;
  }
}

export async function uploadFile(serverId: string, remotePath: string, formData: FormData) {
  const server = await getServerForRunner(serverId);
  if (!server) {
    return { error: 'Server not found.' };
  }
  if (!server.username || !server.privateKey) {
    return { error: 'No username or private key configured for this server.' };
  }

  const sshPassphrase = getServerSshPassphrase(server.moreDetails);

  const file = formData.get('file') as File | null;
  if (!file) {
    return { error: 'No file provided.' };
  }

  const tempDir = path.join(os.tmpdir(), 'neup-uploads');
  await fs.mkdir(tempDir, { recursive: true });
  const tempFilePath = path.join(tempDir, file.name);

  try {
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(tempFilePath, fileBuffer);

    const remoteFilePath = path.join(remotePath, file.name);

    await uploadFileToServer(server.publicIp, server.username, server.privateKey, tempFilePath, remoteFilePath, sshPassphrase ?? undefined);

    revalidatePath(`/servers/${serverId}/server/files`);
    return { success: true };
  } catch (error: any) {
    return { error: `Failed to upload file: ${error.message}` };
  } finally {
    await fs.unlink(tempFilePath).catch(console.error);
  }
}

export async function renameFile(serverId: string, currentPath: string, newName: string, rootMode = false) {
  const server = await getServerForRunner(serverId);
  if (!server || !server.username || !server.privateKey) return { error: 'Server configuration missing.' };

  const sshPassphrase = getServerSshPassphrase(server.moreDetails);

  try {
    const directory = currentPath.substring(0, currentPath.lastIndexOf('/'));
    const newPath = directory ? `${directory}/${newName}` : newName;
    const command = rootMode ? `sudo mv "${currentPath}" "${newPath}"` : `mv "${currentPath}" "${newPath}"`;
    const result = await runCommandOnServer(
      server.publicIp,
      server.username,
      server.privateKey,
      command,
      undefined,
      undefined,
      true,
      {},
      sshPassphrase ?? undefined
    );

    if (result.code !== 0) return { error: result.stderr || 'Rename failed.' };

    revalidatePath('/server/files');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function deleteFiles(serverId: string, paths: string[], rootMode = false) {
  const server = await getServerForRunner(serverId);
  if (!server || !server.username || !server.privateKey) return { error: 'Server configuration missing.' };

  const sshPassphrase = getServerSshPassphrase(server.moreDetails);

  try {
    const pathArgs = paths.map((entry) => `"${entry}"`).join(' ');
    const command = rootMode ? `sudo rm -rf ${pathArgs}` : `rm -rf ${pathArgs}`;
    const result = await runCommandOnServer(
      server.publicIp,
      server.username,
      server.privateKey,
      command,
      undefined,
      undefined,
      true,
      {},
      sshPassphrase ?? undefined
    );

    if (result.code !== 0) return { error: result.stderr || 'Delete failed.' };
    revalidatePath('/server/files');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function moveFiles(serverId: string, sourcePaths: string[], destPath: string, rootMode = false) {
  const server = await getServerForRunner(serverId);
  if (!server || !server.username || !server.privateKey) return { error: 'Server configuration missing.' };

  const sshPassphrase = getServerSshPassphrase(server.moreDetails);

  try {
    const pathArgs = sourcePaths.map((entry) => `"${entry}"`).join(' ');
    const command = rootMode ? `sudo mv ${pathArgs} "${destPath}"` : `mv ${pathArgs} "${destPath}"`;
    const result = await runCommandOnServer(
      server.publicIp,
      server.username,
      server.privateKey,
      command,
      undefined,
      undefined,
      true,
      {},
      sshPassphrase ?? undefined
    );

    if (result.code !== 0) return { error: result.stderr || 'Move failed.' };
    revalidatePath('/server/files');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function copyFiles(serverId: string, sourcePaths: string[], destPath: string, rootMode = false) {
  const server = await getServerForRunner(serverId);
  if (!server || !server.username || !server.privateKey) return { error: 'Server configuration missing.' };

  const sshPassphrase = getServerSshPassphrase(server.moreDetails);

  try {
    const pathArgs = sourcePaths.map((entry) => `"${entry}"`).join(' ');
    const command = rootMode ? `sudo cp -r ${pathArgs} "${destPath}"` : `cp -r ${pathArgs} "${destPath}"`;
    const result = await runCommandOnServer(
      server.publicIp,
      server.username,
      server.privateKey,
      command,
      undefined,
      undefined,
      true,
      {},
      sshPassphrase ?? undefined
    );

    if (result.code !== 0) return { error: result.stderr || 'Copy failed.' };
    revalidatePath('/server/files');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function createDirectory(serverId: string, targetPath: string, rootMode = false) {
  const server = await getServerForRunner(serverId);
  if (!server || !server.username || !server.privateKey) return { error: 'Server configuration missing.' };

  try {
    const command = rootMode ? `sudo mkdir -p "${targetPath}"` : `mkdir -p "${targetPath}"`;
    const result = await runCommandOnServer(
      server.publicIp,
      server.username,
      server.privateKey,
      command,
      undefined,
      undefined,
      true
    );
    if (result.code !== 0) return { error: result.stderr || 'Directory creation failed.' };
    revalidatePath('/server/files');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function createEmptyFile(serverId: string, targetPath: string, rootMode = false) {
  const server = await getServerForRunner(serverId);
  if (!server || !server.username || !server.privateKey) return { error: 'Server configuration missing.' };

  try {
    const command = rootMode ? `sudo touch "${targetPath}"` : `touch "${targetPath}"`;
    const result = await runCommandOnServer(
      server.publicIp,
      server.username,
      server.privateKey,
      command,
      undefined,
      undefined,
      true
    );
    if (result.code !== 0) return { error: result.stderr || 'File creation failed.' };
    revalidatePath('/server/files');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

function normalizeAbsolutePath(candidate: string) {
  const trimmed = (candidate ?? '').trim();
  if (!trimmed) return '/home';
  if (trimmed.startsWith('/')) return trimmed;
  return `/${trimmed}`;
}

function sanitizeExtensions(extensions: string[]) {
  return extensions
    .map((entry) => entry.trim().replace(/^\./, '').toLowerCase())
    .filter(Boolean)
    .filter((entry) => entry.length <= 50)
    .filter((entry) => /^[a-z0-9][a-z0-9.+_-]*$/i.test(entry));
}

export async function searchFilesOnServer(
  serverId: string,
  basePath: string,
  query: string,
  extensions: string[] = [],
  rootMode = false,
  limit = 200
): Promise<{ results: FileSearchResult[]; truncated: boolean; error?: string }> {
  const server = await getServerForRunner(serverId);
  if (!server) return { results: [], truncated: false, error: 'Server not found.' };
  if (!server.username || !server.privateKey) {
    return { results: [], truncated: false, error: 'No username or private key configured for this server.' };
  }

  const sshPassphrase = getServerSshPassphrase(server.moreDetails);

  const safeBasePath = normalizeAbsolutePath(basePath);
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(2000, Math.floor(limit))) : 200;
  const cleanedQuery = (query ?? '').trim();
  const cleanedExtensions = sanitizeExtensions(extensions);

  const findArgs: string[] = [];
  findArgs.push(rootMode ? 'sudo' : '');
  findArgs.push('find', shellQuote(safeBasePath), '-type', 'f');

  if (cleanedQuery) {
    findArgs.push('-iname', shellQuote(`*${cleanedQuery}*`));
  }

  if (cleanedExtensions.length > 0) {
    const extPredicates = cleanedExtensions
      .map((ext) => ['-iname', shellQuote(`*.${ext}`)])
      .flat();

    // Convert to: \( -iname '*.a' -o -iname '*.b' \)
    const grouped: string[] = ['\\('];
    for (let i = 0; i < extPredicates.length; i += 2) {
      if (i > 0) grouped.push('-o');
      grouped.push(extPredicates[i], extPredicates[i + 1]);
    }
    grouped.push('\\)');
    findArgs.push(...grouped);
  }

  // Use epoch seconds for mtime; parse on the app side.
  // Tail via head to avoid sending massive payloads over SSH.
  const command = `${findArgs.filter(Boolean).join(' ')} -printf '%p\\t%s\\t%T@\\n' 2>/dev/null | head -n ${safeLimit + 1}`;

  try {
    const result = await runCommandOnServer(
      server.publicIp,
      server.username,
      server.privateKey,
      command,
      undefined,
      undefined,
      true,
      {},
      sshPassphrase ?? undefined
    );

    if (result.code !== 0 && !result.stdout.trim()) {
      return { results: [], truncated: false, error: result.stderr || `Search failed. Exit code: ${result.code}` };
    }

    const lines = result.stdout.split('\n').filter(Boolean);
    const truncated = lines.length > safeLimit;
    const sliced = lines.slice(0, safeLimit);

    const resultsParsed: FileSearchResult[] = sliced.map((line) => {
      const [filePath, sizeRaw, mtimeRaw] = line.split('\t');
      const name = filePath?.split('/').pop() ?? filePath;
      const directory = filePath?.substring(0, filePath.lastIndexOf('/')) || '/';
      const size = sizeRaw ? Number(sizeRaw) : null;
      const mtimeSeconds = mtimeRaw ? Number(mtimeRaw) : null;
      const modifiedAtEpochMs = mtimeSeconds && Number.isFinite(mtimeSeconds) ? Math.floor(mtimeSeconds * 1000) : null;

      return {
        path: filePath,
        name,
        directory,
        size: Number.isFinite(size as number) ? (size as number) : null,
        modifiedAtEpochMs,
      };
    });

    return { results: resultsParsed, truncated, error: undefined };
  } catch (error: any) {
    return { results: [], truncated: false, error: `Search failed: ${error.message}` };
  }
}
