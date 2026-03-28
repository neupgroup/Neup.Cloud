'use server';

import { revalidatePath } from 'next/cache';
import { createRecordId, queryAppDb, toIsoString } from '@/lib/app-db';

export interface CommandSetCommand {
  id: string;
  title: string;
  command: string;
  description?: string;
  order: number;
  isSkippable?: boolean;
  isRepeatable?: boolean;
}

export interface CommandSet {
  id: string;
  userId: string;
  name: string;
  description?: string;
  commands: CommandSetCommand[];
  createdAt?: string;
}

type CommandSetRow = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  commands: CommandSetCommand[];
  createdAt: Date;
};

function mapCommandSet(row: CommandSetRow): CommandSet {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    description: row.description ?? undefined,
    commands: row.commands ?? [],
    createdAt: toIsoString(row.createdAt),
  };
}

export async function createCommandSet(data: Omit<CommandSet, 'id' | 'createdAt'>) {
  try {
    const id = createRecordId();
    await queryAppDb(`
      INSERT INTO command_sets (
        id,
        "userId",
        name,
        description,
        commands,
        "createdAt"
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
    `, [
      id,
      data.userId,
      data.name,
      data.description ?? null,
      JSON.stringify(data.commands ?? []),
    ]);

    revalidatePath('/commands/set');
    return { success: true, id };
  } catch (error: any) {
    console.error('Error creating command set:', error);
    return { success: false, error: error.message };
  }
}

export async function getCommandSets(userId: string) {
  if (!userId) return [];

  try {
    const result = await queryAppDb<CommandSetRow>(`
      SELECT id, "userId", name, description, commands, "createdAt"
      FROM command_sets
      WHERE "userId" = $1
      ORDER BY "createdAt" DESC
    `, [userId]);

    return result.rows.map(mapCommandSet);
  } catch (error: any) {
    console.error('Error fetching command sets:', error);
    return [];
  }
}

export async function getCommandSet(id: string) {
  try {
    const result = await queryAppDb<CommandSetRow>(`
      SELECT id, "userId", name, description, commands, "createdAt"
      FROM command_sets
      WHERE id = $1
      LIMIT 1
    `, [id]);

    const row = result.rows[0];
    return row ? mapCommandSet(row) : null;
  } catch (error: any) {
    console.error('Error fetching command set:', error);
    return null;
  }
}

export async function updateCommandSet(id: string, data: Partial<Omit<CommandSet, 'id' | 'createdAt' | 'userId'>>) {
  try {
    const assignments: string[] = [];
    const values: unknown[] = [id];

    if (data.name !== undefined) {
      assignments.push(`name = $${values.length + 1}`);
      values.push(data.name);
    }
    if (data.description !== undefined) {
      assignments.push(`description = $${values.length + 1}`);
      values.push(data.description ?? null);
    }
    if (data.commands !== undefined) {
      assignments.push(`commands = $${values.length + 1}::jsonb`);
      values.push(JSON.stringify(data.commands));
    }

    if (assignments.length === 0) {
      return { success: true };
    }

    await queryAppDb(`
      UPDATE command_sets
      SET ${assignments.join(', ')}
      WHERE id = $1
    `, values);

    revalidatePath('/commands/set');
    revalidatePath(`/commands/set/${id}`);
    return { success: true };
  } catch (error: any) {
    console.error('Error updating command set:', error);
    return { success: false, error: error.message };
  }
}

export async function deleteCommandSet(id: string) {
  try {
    await queryAppDb(`
      DELETE FROM command_sets
      WHERE id = $1
    `, [id]);

    revalidatePath('/commands/set');
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting command set:', error);
    return { success: false, error: error.message };
  }
}
