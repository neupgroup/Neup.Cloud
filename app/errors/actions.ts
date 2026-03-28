
'use server';

import { queryAppDb, toIsoString } from '@/lib/app-db';

type AppError = {
  id: string;
  message: string;
  level: 'ERROR' | 'WARNING' | 'INFO';
  source: string;
  timestamp: string; // Changed to string
  stack?: string;
};


export async function getErrors(): Promise<AppError[]> {
  const result = await queryAppDb<{
    id: string;
    message: string;
    level: 'ERROR' | 'WARNING' | 'INFO';
    source: string;
    timestamp: Date;
    stack: string | null;
  }>(`
    SELECT id, message, level, source, timestamp, stack
    FROM errors
    ORDER BY timestamp DESC
  `);

  return result.rows.map((row) => ({
    id: row.id,
    message: row.message,
    level: row.level,
    source: row.source,
    timestamp: toIsoString(row.timestamp) || new Date().toISOString(),
    stack: row.stack ?? undefined,
  }));
}
