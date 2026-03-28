'use server';

import { revalidatePath } from 'next/cache';
import { runCommandOnServer } from '@/services/ssh';
import { getServerForRunner } from '../servers/actions';
import { createRecordId, queryAppDb } from '@/lib/app-db';

type SavedCommandRow = {
  id: string;
  name: string;
  command: string;
  description: string | null;
  nextCommands: string[] | null;
  variables: any[] | null;
};

type ServerLogRow = {
  id: string;
  output: string | null;
};

export async function getSavedCommands() {
  const result = await queryAppDb<SavedCommandRow>(`
    SELECT id, name, command, description, "nextCommands", variables
    FROM saved_commands
    ORDER BY "updatedAt" DESC, name ASC
  `);

  return result.rows.map((row) => ({
    ...row,
    description: row.description ?? undefined,
    nextCommands: row.nextCommands ?? undefined,
    variables: row.variables ?? undefined,
  }));
}

export async function createSavedCommand(data: {
  name: string;
  command: string;
  description?: string;
  nextCommands?: string[];
  variables?: any[];
}) {
  await queryAppDb(`
    INSERT INTO saved_commands (
      id,
      name,
      command,
      description,
      "nextCommands",
      variables,
      "createdAt",
      "updatedAt"
    )
    VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW(), NOW())
  `, [
    createRecordId(),
    data.name,
    data.command,
    data.description ?? null,
    data.nextCommands ?? null,
    JSON.stringify(data.variables ?? null),
  ]);

  revalidatePath('/commands');
}

export async function updateSavedCommand(id: string, data: {
  name: string;
  command: string;
  description?: string;
  nextCommands?: string[];
  variables?: any[];
}) {
  await queryAppDb(`
    UPDATE saved_commands
    SET
      name = $2,
      command = $3,
      description = $4,
      "nextCommands" = $5,
      variables = $6::jsonb,
      "updatedAt" = NOW()
    WHERE id = $1
  `, [
    id,
    data.name,
    data.command,
    data.description ?? null,
    data.nextCommands ?? null,
    JSON.stringify(data.variables ?? null),
  ]);

  revalidatePath('/commands');
}

export async function deleteSavedCommand(id: string) {
  await queryAppDb(`
    DELETE FROM saved_commands
    WHERE id = $1
  `, [id]);

  revalidatePath('/commands');
}

async function updateServerLog(id: string, fields: { output?: string; status?: string; commandName?: string }) {
  const assignments: string[] = [];
  const values: unknown[] = [id];

  if (fields.output !== undefined) {
    assignments.push(`output = $${values.length + 1}`);
    values.push(fields.output);
  }
  if (fields.status !== undefined) {
    assignments.push(`status = $${values.length + 1}`);
    values.push(fields.status);
  }
  if (fields.commandName !== undefined) {
    assignments.push(`"commandName" = $${values.length + 1}`);
    values.push(fields.commandName);
  }

  if (assignments.length === 0) {
    return;
  }

  await queryAppDb(`
    UPDATE server_logs
    SET ${assignments.join(', ')}
    WHERE id = $1
  `, values);
}

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

  const logId = createRecordId();
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
    logId,
    serverId,
    originalCommandTemplate,
    commandName ?? null,
    'Executing command...',
    'pending',
  ]);

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
        void updateServerLog(logId, { output: finalOutput });
      },
      (chunk) => {
        finalOutput += chunk;
        void updateServerLog(logId, { output: finalOutput });
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

    await updateServerLog(logId, { status: finalStatus, output: finalOutput });
    revalidatePath(`/servers/${serverId}`);
    return { logId, status: finalStatus, output: finalOutput };
  } catch (error: any) {
    finalOutput = `Failed to execute command: ${error.message}`;
    await updateServerLog(logId, { status: 'Error', output: finalOutput });
    revalidatePath(`/servers/${serverId}`);
    return { logId, status: 'Error', output: finalOutput };
  }
}

export async function executeCommand(serverId: string, command: string, commandName?: string, displayCommand?: string) {
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

export async function executeSavedCommand(
  serverId: string,
  savedCommandId: string,
  variables: Record<string, string> = {}
) {
  const result = await queryAppDb<SavedCommandRow>(`
    SELECT id, name, command, description, "nextCommands", variables
    FROM saved_commands
    WHERE id = $1
    LIMIT 1
  `, [savedCommandId]);

  const savedCommand = result.rows[0];
  if (!savedCommand) {
    throw new Error('Saved command not found.');
  }

  const commandTemplate = savedCommand.command;
  const server = await getServerForRunner(serverId);
  if (!server) {
    throw new Error('Target server not found.');
  }

  const os = server.type.toLowerCase();
  const osBlockRegex = new RegExp(`<<\\{\\{start\\.${os}\\}\\}\\>>([\\s\\S]*?)<<\\{\\{end\\.${os}\\}\\}\\>>`, 'g');
  const match = osBlockRegex.exec(commandTemplate);

  if (!match || !match[1]) {
    throw new Error(`No command block found for OS "${server.type}" in the saved command.`);
  }

  let processedCommand = match[1].trim();

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

  if (mainResult.status === 'Success' && savedCommand.nextCommands && savedCommand.nextCommands.length > 0) {
    for (const nextCommandId of savedCommand.nextCommands) {
      await executeSavedCommand(serverId, nextCommandId, variables);
    }
  }

  return mainResult;
}
