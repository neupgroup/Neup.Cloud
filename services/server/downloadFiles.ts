// Moved from /app/(main)/servers/[id]/actions.ts
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { getServerForRunner } from '@/services/server/server-service';
import { runCommandOnServer, downloadFileFromServer } from '@/services/server/ssh';

export async function downloadFiles(
  serverId: string,
  paths: string[],
  rootMode = false
): Promise<{ filePath?: string; fileName?: string; error?: string }> {
  const server = await getServerForRunner(serverId);
  if (!server || !server.username) return { error: 'Server configuration missing.' };

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
          ? `cd \"$(dirname \"${remotePath}\")\" && sudo zip -r \"${remoteZipPath}\" \"$(basename \"${remotePath}\")\"`
          : `cd \"$(dirname \"${remotePath}\")\" && zip -r \"${remoteZipPath}\" \"$(basename \"${remotePath}\")\"`;
        const zipResult = await runCommandOnServer(server.publicIp, server.username, server.privateKey, zipCommand, undefined, undefined, true);

        if (zipResult.code !== 0) {
          return { error: zipResult.stderr || 'Failed to create zip archive.' };
        }

        await downloadFileFromServer(server.publicIp, server.username, server.privateKey, remoteZipPath, localZipPath);
        const cleanupCommand = rootMode ? `sudo rm -f \"${remoteZipPath}\"` : `rm -f \"${remoteZipPath}\"`;
        await runCommandOnServer(server.publicIp, server.username, server.privateKey, cleanupCommand, undefined, undefined, true);
        return { filePath: localZipPath, fileName: zipFileName };
      }

      const localFilePath = path.join(tempDir, fileName);
      if (rootMode) {
        const tempRemotePath = `/tmp/${fileName}`;
        const copyCommand = `sudo cp \"${remotePath}\" \"${tempRemotePath}\" && sudo chmod 644 \"${tempRemotePath}\"`;
        const copyResult = await runCommandOnServer(server.publicIp, server.username, server.privateKey, copyCommand, undefined, undefined, true);
        if (copyResult.code !== 0) {
          return { error: copyResult.stderr || 'Failed to prepare file for download.' };
        }
        await downloadFileFromServer(server.publicIp, server.username, server.privateKey, tempRemotePath, localFilePath);
        await runCommandOnServer(server.publicIp, server.username, server.privateKey, `sudo rm -f \"${tempRemotePath}\"`, undefined, undefined, true);
      } else {
        await downloadFileFromServer(server.publicIp, server.username, server.privateKey, remotePath, localFilePath);
      }
      return { filePath: localFilePath, fileName };
    }

    const zipFileName = `download-${Date.now()}.zip`;
    const remoteZipPath = `/tmp/${zipFileName}`;
    const localZipPath = path.join(tempDir, zipFileName);
    const pathArgs = paths.map((entry) => `\"${entry}\"`).join(' ');
    const zipCommand = rootMode
      ? `sudo zip -r \"${remoteZipPath}\" ${pathArgs}`
      : `zip -r \"${remoteZipPath}\" ${pathArgs}`;
    const zipResult = await runCommandOnServer(server.publicIp, server.username, server.privateKey, zipCommand, undefined, undefined, true);
    if (zipResult.code !== 0) {
      return { error: zipResult.stderr || 'Failed to create zip archive.' };
    }
    await downloadFileFromServer(server.publicIp, server.username, server.privateKey, remoteZipPath, localZipPath);
    const cleanupCommand = rootMode ? `sudo rm -f \"${remoteZipPath}\"` : `rm -f \"${remoteZipPath}\"`;
    await runCommandOnServer(server.publicIp, server.username, server.privateKey, cleanupCommand, undefined, undefined, true);
    return { filePath: localZipPath, fileName: zipFileName };
  } catch (error: any) {
    return { error: `Download failed: ${error.message}` };
  }
}
