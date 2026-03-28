
'use server';

import { revalidatePath } from 'next/cache';
import { runCommandOnServer, uploadFileToServer } from '@/services/ssh';
import { getServerForRunner } from '../actions';
import { createRecordId, queryAppDb, toIsoString } from '@/lib/app-db';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export async function runCustomCommandOnServer(serverId: string, command: string) {
  if (!serverId || !command) {
    return { error: "Server and command are required." };
  }

  const server = await getServerForRunner(serverId);

  if (!server) {
    return { error: 'Server not found.' };
  }

  if (!server.username || !server.privateKey) {
    return { error: 'No username or private key configured for this server.' };
  }

  let result;
  try {
    result = await runCommandOnServer(
      server.publicIp,
      server.username,
      server.privateKey,
      command
    );
  } catch (e: any) {
    await queryAppDb(`
      INSERT INTO server_logs (id, "serverId", command, output, status, "runAt")
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [createRecordId(), serverId, command, e.message, 'Error']);
    return { error: `Failed to execute command: ${e.message}` };
  }

  const output = result.code === 0 ? result.stdout : result.stderr;
  const status = result.code === 0 ? 'Success' : 'Error';

  await queryAppDb(`
    INSERT INTO server_logs (id, "serverId", command, output, status, "runAt")
    VALUES ($1, $2, $3, $4, $5, NOW())
  `, [createRecordId(), serverId, command, output, status]);

  revalidatePath(`/servers/${serverId}`);

  return { output: output || `Command executed with status code ${result.code}.` };
}

export async function rebootServer(serverId: string) {
  return await runCustomCommandOnServer(serverId, 'sudo reboot');
}

export async function getServerLogs(serverId: string) {
  const result = await queryAppDb<{
    id: string;
    serverId: string;
    command: string;
    commandName: string | null;
    output: string | null;
    status: string;
    runAt: Date;
  }>(`
    SELECT id, "serverId", command, "commandName", output, status, "runAt"
    FROM server_logs
    WHERE "serverId" = $1
    ORDER BY "runAt" DESC
  `, [serverId]);

  return result.rows.map((row) => ({
    ...row,
    commandName: row.commandName ?? undefined,
    output: row.output ?? undefined,
    runAt: toIsoString(row.runAt) || new Date().toISOString(),
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
    let linkTarget: string | undefined = undefined;

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

export async function browseDirectory(serverId: string, path: string, rootMode = false): Promise<{ files: FileOrFolder[], error?: string }> {
  const server = await getServerForRunner(serverId);
  if (!server) {
    return { files: [], error: 'Server not found.' };
  }
  if (!server.username || !server.privateKey) {
    return { files: [], error: 'No username or private key configured for this server.' };
  }

  try {
    // Use ls -lA to include hidden files except . and ..
    // Append / to path to ensure we list contents of symlinked directories
    const safePath = path.endsWith('/') ? path : `${path}/`;
    // Quote the path to handle spaces
    const cmd = rootMode ? `sudo ls -lA --full-time "${safePath}"` : `ls -lA --full-time "${safePath}"`;
    const result = await runCommandOnServer(server.publicIp, server.username, server.privateKey, cmd, undefined, undefined, true);

    if (result.code !== 0) {
      return { files: [], error: result.stderr || `Failed to list directory contents. Exit code: ${result.code}` };
    }

    const files = parseLsOutput(result.stdout);
    return { files };
  } catch (e: any) {
    return { files: [], error: `Failed to browse directory: ${e.message}` };
  }
}

export async function isDirectory(serverId: string, path: string, rootMode = false): Promise<boolean> {
  const server = await getServerForRunner(serverId);
  if (!server || !server.username || !server.privateKey) return false;

  try {
    const cmd = rootMode ? `sudo test -d "${path}"` : `test -d "${path}"`;
    const result = await runCommandOnServer(server.publicIp, server.username, server.privateKey, cmd, undefined, undefined, true);
    return result.code === 0;
  } catch (e) {
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

    revalidatePath(`/servers/${serverId}/files`);
    return { success: true };
  } catch (e: any) {
    return { error: `Failed to upload file: ${e.message}` };
  } finally {
    // Clean up the temporary file
    await fs.unlink(tempFilePath).catch(console.error);
  }
}

export async function renameFile(serverId: string, currentPath: string, newName: string, rootMode = false) {
  const server = await getServerForRunner(serverId);
  if (!server || !server.username || !server.privateKey) return { error: 'Server configuration missing.' };

  try {
    const directory = currentPath.substring(0, currentPath.lastIndexOf('/'));
    const newPath = directory ? `${directory}/${newName}` : newName;
    const cmd = rootMode ? `sudo mv "${currentPath}" "${newPath}"` : `mv "${currentPath}" "${newPath}"`;
    const result = await runCommandOnServer(server.publicIp, server.username, server.privateKey, cmd, undefined, undefined, true);

    if (result.code !== 0) return { error: result.stderr || 'Rename failed.' };

    revalidatePath(`/files`);
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function deleteFiles(serverId: string, paths: string[], rootMode = false) {
  const server = await getServerForRunner(serverId);
  if (!server || !server.username || !server.privateKey) return { error: 'Server configuration missing.' };

  try {
    const pathArgs = paths.map(p => `"${p}"`).join(' ');
    const cmd = rootMode ? `sudo rm -rf ${pathArgs}` : `rm -rf ${pathArgs}`;
    const result = await runCommandOnServer(server.publicIp, server.username, server.privateKey, cmd, undefined, undefined, true);

    if (result.code !== 0) return { error: result.stderr || 'Delete failed.' };
    revalidatePath(`/files`);
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function moveFiles(serverId: string, sourcePaths: string[], destPath: string, rootMode = false) {
  const server = await getServerForRunner(serverId);
  if (!server || !server.username || !server.privateKey) return { error: 'Server configuration missing.' };

  try {
    const pathArgs = sourcePaths.map(p => `"${p}"`).join(' ');
    const cmd = rootMode ? `sudo mv ${pathArgs} "${destPath}"` : `mv ${pathArgs} "${destPath}"`;
    const result = await runCommandOnServer(server.publicIp, server.username, server.privateKey, cmd, undefined, undefined, true);

    if (result.code !== 0) return { error: result.stderr || 'Move failed.' };
    revalidatePath(`/files`);
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function copyFiles(serverId: string, sourcePaths: string[], destPath: string, rootMode = false) {
  const server = await getServerForRunner(serverId);
  if (!server || !server.username || !server.privateKey) return { error: 'Server configuration missing.' };

  try {
    const pathArgs = sourcePaths.map(p => `"${p}"`).join(' ');
    const cmd = rootMode ? `sudo cp -r ${pathArgs} "${destPath}"` : `cp -r ${pathArgs} "${destPath}"`;
    const result = await runCommandOnServer(server.publicIp, server.username, server.privateKey, cmd, undefined, undefined, true);

    if (result.code !== 0) return { error: result.stderr || 'Copy failed.' };
    revalidatePath(`/files`);
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function createDirectory(serverId: string, path: string, rootMode = false) {
  const server = await getServerForRunner(serverId);
  if (!server || !server.username || !server.privateKey) return { error: 'Server configuration missing.' };

  try {
    const cmd = rootMode ? `sudo mkdir -p "${path}"` : `mkdir -p "${path}"`;
    const result = await runCommandOnServer(server.publicIp, server.username, server.privateKey, cmd, undefined, undefined, true);
    if (result.code !== 0) return { error: result.stderr || 'Directory creation failed.' };
    revalidatePath(`/files`);
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function createEmptyFile(serverId: string, path: string, rootMode = false) {
  const server = await getServerForRunner(serverId);
  if (!server || !server.username || !server.privateKey) return { error: 'Server configuration missing.' };

  try {
    const cmd = rootMode ? `sudo touch "${path}"` : `touch "${path}"`;
    const result = await runCommandOnServer(server.publicIp, server.username, server.privateKey, cmd, undefined, undefined, true);
    if (result.code !== 0) return { error: result.stderr || 'File creation failed.' };
    revalidatePath(`/files`);
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function downloadFiles(serverId: string, paths: string[], rootMode = false): Promise<{ filePath?: string, fileName?: string, error?: string }> {
  const server = await getServerForRunner(serverId);
  if (!server || !server.username || !server.privateKey) return { error: 'Server configuration missing.' };

  const tempDir = path.join(os.tmpdir(), 'neup-downloads');
  await fs.mkdir(tempDir, { recursive: true });

  try {
    // Single file download
    if (paths.length === 1) {
      const remotePath = paths[0];
      const fileName = remotePath.split('/').pop() || 'download';

      // Check if it's a directory
      const checkCmd = rootMode ? `sudo test -d "${remotePath}"` : `test -d "${remotePath}"`;
      const checkResult = await runCommandOnServer(server.publicIp, server.username, server.privateKey, checkCmd, undefined, undefined, true);

      if (checkResult.code === 0) {
        // It's a directory, create a zip
        const zipFileName = `${fileName}.zip`;
        const remoteZipPath = `/tmp/${zipFileName}`;
        const localZipPath = path.join(tempDir, zipFileName);

        // Create zip on remote server
        const zipCmd = rootMode
          ? `cd "$(dirname "${remotePath}")" && sudo zip -r "${remoteZipPath}" "$(basename "${remotePath}")"`
          : `cd "$(dirname "${remotePath}")" && zip -r "${remoteZipPath}" "$(basename "${remotePath}")"`;

        const zipResult = await runCommandOnServer(server.publicIp, server.username, server.privateKey, zipCmd, undefined, undefined, true);

        if (zipResult.code !== 0) {
          return { error: zipResult.stderr || 'Failed to create zip archive.' };
        }

        // Download the zip file
        const { downloadFileFromServer } = await import('@/services/ssh');
        await downloadFileFromServer(server.publicIp, server.username, server.privateKey, remoteZipPath, localZipPath);

        // Clean up remote zip
        const cleanupCmd = rootMode ? `sudo rm -f "${remoteZipPath}"` : `rm -f "${remoteZipPath}"`;
        await runCommandOnServer(server.publicIp, server.username, server.privateKey, cleanupCmd, undefined, undefined, true);

        return { filePath: localZipPath, fileName: zipFileName };
      } else {
        // It's a file, download directly
        const localFilePath = path.join(tempDir, fileName);

        // If root mode, we need to copy to a temp location first
        if (rootMode) {
          const tempRemotePath = `/tmp/${fileName}`;
          const copyCmd = `sudo cp "${remotePath}" "${tempRemotePath}" && sudo chmod 644 "${tempRemotePath}"`;
          const copyResult = await runCommandOnServer(server.publicIp, server.username, server.privateKey, copyCmd, undefined, undefined, true);

          if (copyResult.code !== 0) {
            return { error: copyResult.stderr || 'Failed to prepare file for download.' };
          }

          const { downloadFileFromServer } = await import('@/services/ssh');
          await downloadFileFromServer(server.publicIp, server.username, server.privateKey, tempRemotePath, localFilePath);

          // Clean up temp file
          const cleanupCmd = `sudo rm -f "${tempRemotePath}"`;
          await runCommandOnServer(server.publicIp, server.username, server.privateKey, cleanupCmd, undefined, undefined, true);
        } else {
          const { downloadFileFromServer } = await import('@/services/ssh');
          await downloadFileFromServer(server.publicIp, server.username, server.privateKey, remotePath, localFilePath);
        }

        return { filePath: localFilePath, fileName };
      }
    } else {
      // Multiple files/folders - create a zip
      const zipFileName = `download-${Date.now()}.zip`;
      const remoteZipPath = `/tmp/${zipFileName}`;
      const localZipPath = path.join(tempDir, zipFileName);

      // Create zip with all selected files
      const pathArgs = paths.map(p => `"${p}"`).join(' ');
      const zipCmd = rootMode
        ? `sudo zip -r "${remoteZipPath}" ${pathArgs}`
        : `zip -r "${remoteZipPath}" ${pathArgs}`;

      const zipResult = await runCommandOnServer(server.publicIp, server.username, server.privateKey, zipCmd, undefined, undefined, true);

      if (zipResult.code !== 0) {
        return { error: zipResult.stderr || 'Failed to create zip archive.' };
      }

      // Download the zip file
      const { downloadFileFromServer } = await import('@/services/ssh');
      await downloadFileFromServer(server.publicIp, server.username, server.privateKey, remoteZipPath, localZipPath);

      // Clean up remote zip
      const cleanupCmd = rootMode ? `sudo rm -f "${remoteZipPath}"` : `rm -f "${remoteZipPath}"`;
      await runCommandOnServer(server.publicIp, server.username, server.privateKey, cleanupCmd, undefined, undefined, true);

      return { filePath: localZipPath, fileName: zipFileName };
    }
  } catch (e: any) {
    return { error: `Download failed: ${e.message}` };
  }
}
