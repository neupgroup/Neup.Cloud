'use server';

import { revalidatePath } from 'next/cache';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { getServerLogsByServerId } from '@/services/server-logs/data';
import { runCustomCommandOnServer as runCustomCommandOnServerLogic } from '@/services/servers/logic';
import { runCommandOnServer, uploadFileToServer } from '@/services/ssh';
import { getServerForRunner } from '../actions';

export async function runCustomCommandOnServer(serverId: string, command: string) {
  const result = await runCustomCommandOnServerLogic(serverId, command);
  revalidatePath(`/servers/${serverId}`);
  return result;
}

export async function rebootServer(serverId: string) {
  return runCustomCommandOnServer(serverId, 'sudo reboot');
}

export async function getServerLogs(serverId: string) {
  const logs = await getServerLogsByServerId(serverId);

  return logs.map((log) => ({
    ...log,
    commandName: log.commandName ?? undefined,
    output: log.output ?? undefined,
    runAt: log.runAt.toISOString(),
  }));
}

export type FileOrFolder = {
  name: string;
  type: 'file' | 'directory' | 'symlink';
  size: number;
  lastModified: string;
  permissions: string;
  linkTarget?: string;
};

function parseLsOutput(output: string): FileOrFolder[] {
  if (!output) return [];
  const lines = output.trim().split('\n');

  return lines.slice(1).map((line): FileOrFolder | null => {
    const parts = line.split(/\s+/);
    if (parts.length < 9) return null;

    const permissions = parts[0];
    const type = permissions.startsWith('d') ? 'directory' : permissions.startsWith('l') ? 'symlink' : 'file';
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
  }).filter((item): item is FileOrFolder => item !== null);
}

export async function browseDirectory(serverId: string, targetPath: string, rootMode = false): Promise<{ files: FileOrFolder[]; error?: string }> {
  const server = await getServerForRunner(serverId);
  if (!server) {
    return { files: [], error: 'Server not found.' };
  }
  if (!server.username || !server.privateKey) {
    return { files: [], error: 'No username or private key configured for this server.' };
  }

  try {
    const safePath = targetPath.endsWith('/') ? targetPath : `${targetPath}/`;
    const command = rootMode ? `sudo ls -lA --full-time "${safePath}"` : `ls -lA --full-time "${safePath}"`;
    const result = await runCommandOnServer(server.publicIp, server.username, server.privateKey, command, undefined, undefined, true);

    if (result.code !== 0) {
      return { files: [], error: result.stderr || `Failed to list directory contents. Exit code: ${result.code}` };
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

  try {
    const command = rootMode ? `sudo test -d "${targetPath}"` : `test -d "${targetPath}"`;
    const result = await runCommandOnServer(server.publicIp, server.username, server.privateKey, command, undefined, undefined, true);
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

    await uploadFileToServer(
      server.publicIp,
      server.username,
      server.privateKey,
      tempFilePath,
      remoteFilePath
    );

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

  try {
    const directory = currentPath.substring(0, currentPath.lastIndexOf('/'));
    const newPath = directory ? `${directory}/${newName}` : newName;
    const command = rootMode ? `sudo mv "${currentPath}" "${newPath}"` : `mv "${currentPath}" "${newPath}"`;
    const result = await runCommandOnServer(server.publicIp, server.username, server.privateKey, command, undefined, undefined, true);

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

  try {
    const pathArgs = paths.map((entry) => `"${entry}"`).join(' ');
    const command = rootMode ? `sudo rm -rf ${pathArgs}` : `rm -rf ${pathArgs}`;
    const result = await runCommandOnServer(server.publicIp, server.username, server.privateKey, command, undefined, undefined, true);

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

  try {
    const pathArgs = sourcePaths.map((entry) => `"${entry}"`).join(' ');
    const command = rootMode ? `sudo mv ${pathArgs} "${destPath}"` : `mv ${pathArgs} "${destPath}"`;
    const result = await runCommandOnServer(server.publicIp, server.username, server.privateKey, command, undefined, undefined, true);

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

  try {
    const pathArgs = sourcePaths.map((entry) => `"${entry}"`).join(' ');
    const command = rootMode ? `sudo cp -r ${pathArgs} "${destPath}"` : `cp -r ${pathArgs} "${destPath}"`;
    const result = await runCommandOnServer(server.publicIp, server.username, server.privateKey, command, undefined, undefined, true);

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
    const result = await runCommandOnServer(server.publicIp, server.username, server.privateKey, command, undefined, undefined, true);
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
    const result = await runCommandOnServer(server.publicIp, server.username, server.privateKey, command, undefined, undefined, true);
    if (result.code !== 0) return { error: result.stderr || 'File creation failed.' };
    revalidatePath('/server/files');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function downloadFiles(
  serverId: string,
  paths: string[],
  rootMode = false
): Promise<{ filePath?: string; fileName?: string; error?: string }> {
  const server = await getServerForRunner(serverId);
  if (!server || !server.username || !server.privateKey) return { error: 'Server configuration missing.' };

  const tempDir = path.join(os.tmpdir(), 'neup-downloads');
  await fs.mkdir(tempDir, { recursive: true });

  try {
    if (paths.length === 1) {
      const remotePath = paths[0];
      const fileName = remotePath.split('/').pop() || 'download';
      const checkCommand = rootMode ? `sudo test -d "${remotePath}"` : `test -d "${remotePath}"`;
      const checkResult = await runCommandOnServer(server.publicIp, server.username, server.privateKey, checkCommand, undefined, undefined, true);

      if (checkResult.code === 0) {
        const zipFileName = `${fileName}.zip`;
        const remoteZipPath = `/tmp/${zipFileName}`;
        const localZipPath = path.join(tempDir, zipFileName);
        const zipCommand = rootMode
          ? `cd "$(dirname "${remotePath}")" && sudo zip -r "${remoteZipPath}" "$(basename "${remotePath}")"`
          : `cd "$(dirname "${remotePath}")" && zip -r "${remoteZipPath}" "$(basename "${remotePath}")"`;
        const zipResult = await runCommandOnServer(server.publicIp, server.username, server.privateKey, zipCommand, undefined, undefined, true);

        if (zipResult.code !== 0) {
          return { error: zipResult.stderr || 'Failed to create zip archive.' };
        }

        const { downloadFileFromServer } = await import('@/services/ssh');
        await downloadFileFromServer(server.publicIp, server.username, server.privateKey, remoteZipPath, localZipPath);

        const cleanupCommand = rootMode ? `sudo rm -f "${remoteZipPath}"` : `rm -f "${remoteZipPath}"`;
        await runCommandOnServer(server.publicIp, server.username, server.privateKey, cleanupCommand, undefined, undefined, true);

        return { filePath: localZipPath, fileName: zipFileName };
      }

      const localFilePath = path.join(tempDir, fileName);

      if (rootMode) {
        const tempRemotePath = `/tmp/${fileName}`;
        const copyCommand = `sudo cp "${remotePath}" "${tempRemotePath}" && sudo chmod 644 "${tempRemotePath}"`;
        const copyResult = await runCommandOnServer(server.publicIp, server.username, server.privateKey, copyCommand, undefined, undefined, true);

        if (copyResult.code !== 0) {
          return { error: copyResult.stderr || 'Failed to prepare file for download.' };
        }

        const { downloadFileFromServer } = await import('@/services/ssh');
        await downloadFileFromServer(server.publicIp, server.username, server.privateKey, tempRemotePath, localFilePath);
        await runCommandOnServer(server.publicIp, server.username, server.privateKey, `sudo rm -f "${tempRemotePath}"`, undefined, undefined, true);
      } else {
        const { downloadFileFromServer } = await import('@/services/ssh');
        await downloadFileFromServer(server.publicIp, server.username, server.privateKey, remotePath, localFilePath);
      }

      return { filePath: localFilePath, fileName };
    }

    const zipFileName = `download-${Date.now()}.zip`;
    const remoteZipPath = `/tmp/${zipFileName}`;
    const localZipPath = path.join(tempDir, zipFileName);
    const pathArgs = paths.map((entry) => `"${entry}"`).join(' ');
    const zipCommand = rootMode
      ? `sudo zip -r "${remoteZipPath}" ${pathArgs}`
      : `zip -r "${remoteZipPath}" ${pathArgs}`;
    const zipResult = await runCommandOnServer(server.publicIp, server.username, server.privateKey, zipCommand, undefined, undefined, true);

    if (zipResult.code !== 0) {
      return { error: zipResult.stderr || 'Failed to create zip archive.' };
    }

    const { downloadFileFromServer } = await import('@/services/ssh');
    await downloadFileFromServer(server.publicIp, server.username, server.privateKey, remoteZipPath, localZipPath);

    const cleanupCommand = rootMode ? `sudo rm -f "${remoteZipPath}"` : `rm -f "${remoteZipPath}"`;
    await runCommandOnServer(server.publicIp, server.username, server.privateKey, cleanupCommand, undefined, undefined, true);

    return { filePath: localZipPath, fileName: zipFileName };
  } catch (error: any) {
    return { error: `Download failed: ${error.message}` };
  }
}
