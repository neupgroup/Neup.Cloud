'use server';

import { revalidatePath } from 'next/cache';
import { createRecordId, queryAppDb, toIsoString } from '@/lib/app-db';

export interface EnvironmentVariable {
    id: string;
    key: string;
    value: string;
    targetType: 'account' | 'server' | 'app';
    selectedTargets: string[];
    isConfidential: boolean;
    protectValue: boolean;
    createdAt?: any;
}

export async function getEnvironmentVariables() {
    try {
        const result = await queryAppDb<{
          id: string;
          key: string;
          value: string;
          targetType: 'account' | 'server' | 'app';
          selectedTargets: string[];
          isConfidential: boolean;
          protectValue: boolean;
          createdAt: Date;
        }>(`
          SELECT
            id,
            key,
            value,
            "targetType",
            "selectedTargets",
            "isConfidential",
            "protectValue",
            "createdAt"
          FROM environment_variables
          ORDER BY key ASC
        `);

        const variables: EnvironmentVariable[] = result.rows.map((row) => ({
          id: row.id,
          key: row.key,
          value: row.value,
          targetType: row.targetType,
          selectedTargets: row.selectedTargets ?? [],
          isConfidential: row.isConfidential,
          protectValue: row.protectValue,
          createdAt: toIsoString(row.createdAt),
        }));

        return { variables };
    } catch (error: any) {
        return { error: error.message };
    }
}

export async function createEnvironmentVariable(data: Omit<EnvironmentVariable, 'id' | 'createdAt'>) {
    try {
        await queryAppDb(`
          INSERT INTO environment_variables (
            id,
            key,
            value,
            "targetType",
            "selectedTargets",
            "isConfidential",
            "protectValue",
            "createdAt"
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        `, [
          createRecordId(),
          data.key,
          data.value,
          data.targetType,
          data.selectedTargets ?? [],
          data.isConfidential,
          data.protectValue,
        ]);

        revalidatePath('/environments');
        return { success: true };
    } catch (error: any) {
        return { error: error.message };
    }
}

export async function deleteEnvironmentVariable(id: string) {
    try {
        await queryAppDb(`
          DELETE FROM environment_variables
          WHERE id = $1
        `, [id]);

        revalidatePath('/environments');
        return { success: true };
    } catch (error: any) {
        return { error: error.message };
    }
}
