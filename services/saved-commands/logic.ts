import { runCommandOnServer } from '@/services/ssh';
import { createServerLog, getServerLogById, updateServerLog } from '@/services/server-logs/data';
import { getSavedCommandById } from '@/services/saved-commands/data';
import { getServerForRunner } from '@/services/servers/logic';

async function executeSingleCommand(
  serverId: string,
  command: string,
  originalCommandTemplate: string,
  commandName?: string,
  variables: Record<string, any> = {}
): Promise<{ logId: string; status: 'Success' | 'Error'; output: string }> {
  const server = await getServerForRunner(serverId);
  if (!server) {
    throw new Error('Server not found.');
  }
  if (!server.username || !server.privateKey) {
    throw new Error('No username or private key configured for this server.');
  }

  const log = await createServerLog({
    serverId,
    command: originalCommandTemplate,
    commandName: commandName ?? null,
    output: 'Executing command...',
    status: 'pending',
  });

  let finalOutput = '';
  let finalStatus: 'Success' | 'Error' = 'Error';

  try {
    const serverVariables = {
      'server.name': server.name,
      'server.publicIp': server.publicIp,
      'server.os': server.type || 'linux',
      ...variables,
    };

    const result = await runCommandOnServer(
      server.publicIp,
      server.username,
      server.privateKey,
      command,
      (chunk) => {
        finalOutput += chunk;
        void updateServerLog(log.id, { output: finalOutput });
      },
      (chunk) => {
        finalOutput += chunk;
        void updateServerLog(log.id, { output: finalOutput });
      },
      false,
      serverVariables
    );

    if (result.code === 0) {
      finalStatus = 'Success';
      finalOutput = result.stdout;
    } else {
      finalOutput = result.stderr || `Command exited with code ${result.code}`;
    }

    await updateServerLog(log.id, { status: finalStatus, output: finalOutput });
    return { logId: log.id, status: finalStatus, output: finalOutput };
  } catch (error: any) {
    finalOutput = `Failed to execute command: ${error.message}`;
    await updateServerLog(log.id, { status: 'Error', output: finalOutput });
    return { logId: log.id, status: 'Error', output: finalOutput };
  }
}

export async function executeCommand(
  serverId: string,
  command: string,
  commandName?: string,
  displayCommand?: string
) {
  if (!serverId) {
    return { error: 'Server not selected' };
  }

  try {
    const result = await executeSingleCommand(serverId, command, displayCommand || command, commandName);
    return { output: result.output, error: result.status === 'Error' ? result.output : undefined };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function executeQuickCommand(serverId: string, command: string) {
  if (!serverId) {
    return { error: 'Server not selected' };
  }

  try {
    const server = await getServerForRunner(serverId);
    if (!server) {
      return { error: 'Server not found' };
    }
    if (!server.username || !server.privateKey) {
      return { error: 'No username or private key configured for this server' };
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

    return {
      output: result.stdout + (result.stderr ? '\n' + result.stderr : ''),
      error: result.code !== 0 ? (result.stderr || `Command exited with code ${result.code}`) : undefined,
      exitCode: result.code,
    };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function appendLiveSessionLog(logId: string, command: string, output: string, timestamp: string) {
  const log = await getServerLogById(logId);
  const currentOutput = log?.output || '';
  const newEntry = `\n${timestamp} [COMMAND]: ${command}\n${timestamp} [OUTPUT]: ${output}`;
  await updateServerLog(logId, { output: currentOutput + newEntry });
}

export async function executeSavedCommand(
  serverId: string,
  savedCommandId: string,
  variables: Record<string, string> = {}
) {
  const savedCommand = await getSavedCommandById(savedCommandId);
  if (!savedCommand) {
    throw new Error('Saved command not found.');
  }

  const server = await getServerForRunner(serverId);
  if (!server) {
    throw new Error('Target server not found.');
  }

  const commandTemplate = savedCommand.command;
  const os = server.type.toLowerCase();
  const osBlockRegex = new RegExp(`<<\\{\\{start\\.${os}\\}\\}\\>>([\\s\\S]*?)<<\\{\\{end\\.${os}\\}\\}\\>>`, 'g');
  const match = osBlockRegex.exec(commandTemplate);

  let processedCommand = match?.[1] ? match[1].trim() : commandTemplate.trim();

  for (const key in variables) {
    processedCommand = processedCommand.replace(new RegExp(`\\{\\{\\[\\[${key}\\]\\]\\}\\}`, 'g'), variables[key]);
  }

  const universalVars: Record<string, string> = {
    'universal.serverIp': server.publicIp,
    'universal.serverName': server.name,
    'universal.serverUsername': server.username,
  };

  for (const key in universalVars) {
    processedCommand = processedCommand.replace(new RegExp(`<<\\{\\{\\[${key}\\]\\}\\}\\}>>`, 'g'), universalVars[key]);
  }

  if (/\{\{\[\[.*\]\]\}\}/.test(processedCommand) || /<<\{\{\[.*\]\}\}>>/.test(processedCommand)) {
    throw new Error('One or more variables were not provided or could not be resolved.');
  }

  const combinedVariables = { ...variables, ...universalVars };
  const mainResult = await executeSingleCommand(serverId, processedCommand, commandTemplate, undefined, combinedVariables);

  for (const nextCommandId of savedCommand.nextCommands ?? []) {
    if (mainResult.status !== 'Success') {
      break;
    }
    await executeSavedCommand(serverId, nextCommandId, variables);
  }

  return mainResult;
}
