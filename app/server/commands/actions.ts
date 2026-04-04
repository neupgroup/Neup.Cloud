'use server';

import { revalidatePath } from 'next/cache';
import {
  createSavedCommand as createSavedCommandRecord,
  deleteSavedCommand as deleteSavedCommandRecord,
  getSavedCommands as getSavedCommandsData,
  updateSavedCommand as updateSavedCommandRecord,
} from '@/services/saved-commands/data';
import {
  executeCommand as executeCommandLogic,
  executeQuickCommand as executeQuickCommandLogic,
  executeSavedCommand as executeSavedCommandLogic,
} from '@/services/saved-commands/logic';

export async function getSavedCommands() {
  return getSavedCommandsData();
}

export async function createSavedCommand(data: {
  name: string;
  command: string;
  description?: string;
  nextCommands?: string[];
  variables?: any[];
}) {
  await createSavedCommandRecord(data);
  revalidatePath('/server/commands');
}

export async function updateSavedCommand(id: string, data: {
  name: string;
  command: string;
  description?: string;
  nextCommands?: string[];
  variables?: any[];
}) {
  await updateSavedCommandRecord(id, data);
  revalidatePath('/server/commands');
}

export async function deleteSavedCommand(id: string) {
  await deleteSavedCommandRecord(id);
  revalidatePath('/server/commands');
}

export async function executeCommand(serverId: string, command: string, commandName?: string, displayCommand?: string) {
  const result = await executeCommandLogic(serverId, command, commandName, displayCommand);

  if (serverId) {
    revalidatePath(`/servers/${serverId}`);
  }

  return result;
}

export async function executeQuickCommand(serverId: string, command: string) {
  return executeQuickCommandLogic(serverId, command);
}

export async function executeSavedCommand(
  serverId: string,
  savedCommandId: string,
  variables: Record<string, string> = {}
) {
  const result = await executeSavedCommandLogic(serverId, savedCommandId, variables);

  if (serverId) {
    revalidatePath(`/servers/${serverId}`);
  }

  return result;
}
