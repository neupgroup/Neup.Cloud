import { sanitizeAppName } from '@/services/core/universal';
import { executeQuickCommand } from '@/services/saved-commands/saved-commands-service';

export async function getApplicationLogsForServer(serverId: string, appName: string, lines: number = 50) {
  const sanitizedName = sanitizeAppName(appName);
  const command = `pm2 logs "${sanitizedName}" --lines ${lines} --nostream --raw`;
  const result = await executeQuickCommand(serverId, command);

  if (result.error) {
    return { error: result.error };
  }

  return { logs: result.output };
}
