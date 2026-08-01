'use server';

import { ensureIntelligenceTables, getIntelligenceDbPool } from '@/services/intelligence/db';

export interface OpenFlowUsageLogRecord {
  id: number;
  accountId: string;
  tokenLast4: string;
  modelUsed: string;
  provider: string;
  usedAt: Date;
}

export async function getOpenFlowUsageLogs(
  accountId: string,
  limit: number = 20
): Promise<OpenFlowUsageLogRecord[]> {
  try {
    await ensureIntelligenceTables();
    const db = await getIntelligenceDbPool();

    const result = await db.query<{
      id: string | number;
      account_id: string;
      token_last4: string;
      model_used: string;
      provider: string;
      used_at: string | Date;
    }>(
      `
        SELECT id, account_id, token_last4, model_used, provider, used_at
        FROM "openflow_usage_log"
        WHERE account_id = $1
        ORDER BY used_at DESC
        LIMIT $2
      `,
      [accountId, limit]
    );

    return result.rows.map((row) => ({
      id: typeof row.id === 'string' ? parseInt(row.id, 10) : row.id,
      accountId: row.account_id,
      tokenLast4: row.token_last4,
      modelUsed: row.model_used,
      provider: row.provider,
      usedAt: new Date(row.used_at),
    }));
  } catch (error) {
    console.error('Failed to fetch OpenFlow usage logs:', error);
    return [];
  }
}
