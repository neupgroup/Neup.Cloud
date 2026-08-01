import 'server-only';

import { ensureIntelligenceTables, getIntelligenceDbPool } from '@/services/intelligence/db';

export type IntelligenceAccessType = 'open' | 'hybrid' | 'closed';
export type IntelligenceAccessStatus = 'unpublished' | 'dev' | 'prod' | 'hold';

export interface AccessTokenRecord {
  id: number;
  account_id: string;
  accountId: string;
  name: string;
  key: string;
}

export interface StoredModelConfig {
  id: number;
  title: string;
  provider: string;
  model: string;
  description: string | null;
  currency: string;
  inputRate: string;
  outputRate: string;
  inputCostPer1000Tokens: number;
  outputCostPer1000Tokens: number;
  price: Record<string, unknown>;
}

export interface IntelligenceAccessRecord {
  id: string;
  account_id: string;
  accountId: string;
  key_hash: string;
  type: string;
  available_to: unknown;
  details: unknown;
  max_tokens: number | null;
  maxTokens: number | null;
  token_balance: number;
  balance: number;
  status: string;
  prompt_id: string;
  defPrompt: string | null;
  primaryModel: string | null;
  fallbackModel: string | null;
  primaryModelConfig: StoredModelConfig | null;
  fallbackModelConfig: StoredModelConfig | null;
  primaryAccessKey: number | null;
  fallbackAccessKey: number | null;
  created_at: Date;
  updated_at: Date;
}

interface IntelligenceAccessRow {
  id: string | number | bigint;
  account_id: string;
  key_hash: string;
  type: string;
  available_to: unknown;
  details: unknown;
  max_tokens: number | null;
  token_balance: number;
  status: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface IntelligenceLogRecord {
  id: number;
  access_id: string;
  account_id: string | null;
  query: string | null;
  response: string | null;
  context: string | null;
  modal: string | null;
  currency: string | null;
  cost: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  balance: number | null;
  logged_on: Date;
}

export interface IntelligenceDevLogRecord {
  id: number;
  account_id: string | null;
  access_id: string | null;
  request_id: string;
  request_method: string;
  request_url: string;
  request_headers: unknown;
  request_body: unknown;
  request_query: unknown;
  request_context: unknown;
  response_status: number | null;
  response_body: unknown;
  error_message: string | null;
  error_stack: string | null;
  created_at: Date;
}

function toNumber(value: unknown): number {
  if (typeof value === 'bigint') return Number(value);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function parseJsonString(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normalizeDetails(details: unknown): unknown {
  return typeof details === 'string' ? parseJsonString(details) : details;
}

function normalizeModelConfig(value: unknown): StoredModelConfig | null {
  const record = asRecord(value);
  const id = toNumber(record.id);
  const provider = typeof record.provider === 'string' ? record.provider : '';
  const model = typeof record.model === 'string' ? record.model : '';

  if (!provider || !model) return null;

  const inputCost = toNumber(record.inputCostPer1000Tokens ?? record.inputPrice);
  const outputCost = toNumber(record.outputCostPer1000Tokens ?? record.outputPrice);

  return {
    id,
    title: typeof record.title === 'string' ? record.title : `${provider}:${model}`,
    provider,
    model,
    description: typeof record.description === 'string' ? record.description : null,
    currency: typeof record.currency === 'string' ? record.currency : 'USD',
    inputRate: typeof record.inputRate === 'string' ? record.inputRate : String(inputCost),
    outputRate: typeof record.outputRate === 'string' ? record.outputRate : String(outputCost),
    inputCostPer1000Tokens: inputCost,
    outputCostPer1000Tokens: outputCost,
    price: asRecord(record.price),
  };
}

function modelStringFromConfig(config: StoredModelConfig | null): string | null {
  return config ? `${config.provider}:${config.model}` : null;
}

function mapAccess(row: IntelligenceAccessRow): IntelligenceAccessRecord {
  const details = normalizeDetails(row.details);
  const record = asRecord(details);
  const arrayDetails = Array.isArray(details) ? details : [];
  const primaryModelConfig = normalizeModelConfig(record.primaryModelConfig);
  const fallbackModelConfig = normalizeModelConfig(record.fallbackModelConfig);
  const id = String(row.id);
  const maxTokens = toNullableNumber(record.maxTokens) ?? row.max_tokens;
  const defPrompt =
    typeof record.defPrompt === 'string'
      ? record.defPrompt
      : typeof record.prompt === 'string'
        ? record.prompt
        : typeof arrayDetails[0] === 'string' && !arrayDetails[0].includes('/')
          ? arrayDetails[0]
          : null;

  return {
    id,
    account_id: row.account_id,
    accountId: row.account_id,
    key_hash: row.key_hash,
    type: row.type,
    available_to: row.available_to,
    details,
    max_tokens: maxTokens,
    maxTokens,
    token_balance: Number(row.token_balance || 0),
    balance: Number(row.token_balance || 0),
    status: row.status,
    prompt_id: id,
    defPrompt,
    primaryModel: typeof record.primaryModel === 'string' ? record.primaryModel : modelStringFromConfig(primaryModelConfig),
    fallbackModel: typeof record.fallbackModel === 'string' ? record.fallbackModel : modelStringFromConfig(fallbackModelConfig),
    primaryModelConfig,
    fallbackModelConfig,
    primaryAccessKey: toNullableNumber(record.primaryAccessKey),
    fallbackAccessKey: toNullableNumber(record.fallbackAccessKey),
    created_at: row.created_at ?? new Date(0),
    updated_at: row.updated_at ?? new Date(0),
  };
}

export async function getAccessTokens(accountId: string): Promise<AccessTokenRecord[]> {
  const result = await (await getIntelligenceDbPool()).query<{
    id: string | number;
    account_id: string;
    name: string;
    key: string;
  }>(
    'SELECT id, account_id, name, "key" FROM "accessTokens" WHERE account_id = $1 ORDER BY id DESC',
    [accountId]
  );

  return result.rows.map((row) => ({
    id: toNumber(row.id),
    account_id: row.account_id,
    accountId: row.account_id,
    name: row.name,
    key: row.key,
  }));
}

export async function getAccessTokenById(accountId: string, tokenId: number): Promise<AccessTokenRecord | null> {
  const tokens = await getAccessTokens(accountId);
  return tokens.find((token) => token.id === tokenId) ?? null;
}

export async function createAccessTokenRecord(input: { accountId: string; name: string; key: string }) {
  await (await getIntelligenceDbPool()).query(
    'INSERT INTO "accessTokens" (account_id, name, "key") VALUES ($1, $2, $3)',
    [input.accountId, input.name, input.key]
  );
}

export async function getIntelligenceModels(): Promise<StoredModelConfig[]> {
  const result = await (await getIntelligenceDbPool()).query<{
    id: string | number;
    title: string;
    provider: string;
    model: string;
    description: string | null;
    currency: string;
    inputPrice: number;
    outputPrice: number;
  }>('SELECT id, title, provider, model, description, currency, "inputPrice", "outputPrice" FROM "intelligence_models" ORDER BY id DESC');

  return result.rows.map((row) => ({
    id: toNumber(row.id),
    title: row.title,
    provider: row.provider,
    model: row.model,
    description: row.description,
    currency: row.currency || 'USD',
    inputRate: String(row.inputPrice ?? 0),
    outputRate: String(row.outputPrice ?? 0),
    inputCostPer1000Tokens: Number(row.inputPrice ?? 0),
    outputCostPer1000Tokens: Number(row.outputPrice ?? 0),
    price: {},
  }));
}

export async function getIntelligenceModelById(modelId: number): Promise<StoredModelConfig | null> {
  const models = await getIntelligenceModels();
  return models.find((model) => model.id === modelId) ?? null;
}

export async function createIntelligenceModelRecord(input: {
  title: string;
  provider: string;
  model: string;
  description: string | null;
  currency: string;
  inputRate: string;
  outputRate: string;
  inputCostPer1000Tokens: number;
  outputCostPer1000Tokens: number;
}) {
  await (await getIntelligenceDbPool()).query(
    `
      INSERT INTO "intelligence_models" (title, provider, model, description, currency, "inputPrice", "outputPrice")
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [
      input.title,
      input.provider,
      input.model,
      input.description,
      input.currency,
      input.inputCostPer1000Tokens,
      input.outputCostPer1000Tokens,
    ]
  );
}

export async function updateIntelligenceModelRecord(input: {
  modelId: number;
  title: string;
  provider: string;
  model: string;
  description: string | null;
  currency: string;
  inputCostPer1000Tokens: number;
  outputCostPer1000Tokens: number;
}) {
  await (await getIntelligenceDbPool()).query(
    `
      UPDATE "intelligence_models"
      SET title = $1, provider = $2, model = $3, description = $4, currency = $5, "inputPrice" = $6, "outputPrice" = $7
      WHERE id = $8
    `,
    [
      input.title,
      input.provider,
      input.model,
      input.description,
      input.currency,
      input.inputCostPer1000Tokens,
      input.outputCostPer1000Tokens,
      input.modelId,
    ]
  );
}

export async function deleteIntelligenceModelRecord(input: { modelId: number }) {
  await (await getIntelligenceDbPool()).query('DELETE FROM "intelligence_models" WHERE id = $1', [input.modelId]);
}

export async function getIntelligenceAccesses(accountId: string): Promise<IntelligenceAccessRecord[]> {
  const result = await (await getIntelligenceDbPool()).query<IntelligenceAccessRow>(
    `
      SELECT id, account_id, key_hash, type, available_to, details, max_tokens, token_balance, status, created_at, updated_at
      FROM "intelligence_access"
      WHERE account_id = $1
      ORDER BY updated_at DESC
    `,
    [accountId]
  );

  return result.rows.map(mapAccess);
}

export async function getIntelligenceAccessById(accountId: string, accessId: string): Promise<IntelligenceAccessRecord | null> {
  const result = await (await getIntelligenceDbPool()).query<IntelligenceAccessRow>(
    `
      SELECT id, account_id, key_hash, type, available_to, details, max_tokens, token_balance, status, created_at, updated_at
      FROM "intelligence_access"
      WHERE account_id = $1 AND id = $2
      LIMIT 1
    `,
    [accountId, accessId]
  );

  return result.rows[0] ? mapAccess(result.rows[0]) : null;
}

export async function createIntelligenceAccessRecord(input: {
  accessIdentifier: string;
  accountId: string;
  tokenHash: string;
  status: IntelligenceAccessStatus;
  accessType: IntelligenceAccessType;
  maxTokens: number | null;
  prompt?: string | null;
  details?: unknown;
  primaryModel?: { provider: string; model: string; apiKey?: string | null; tokenId?: number | null } | null;
  fallbackModel?: { provider: string; model: string; apiKey?: string | null; tokenId?: number | null } | null;
}): Promise<string> {
  const details = input.details ?? {
    defPrompt: input.prompt ?? null,
    primaryModel: input.primaryModel ? `${input.primaryModel.provider}:${input.primaryModel.model}` : null,
    fallbackModel: input.fallbackModel ? `${input.fallbackModel.provider}:${input.fallbackModel.model}` : null,
    primaryModelConfig: input.primaryModel ? { provider: input.primaryModel.provider, model: input.primaryModel.model } : null,
    fallbackModelConfig: input.fallbackModel ? { provider: input.fallbackModel.provider, model: input.fallbackModel.model } : null,
    primaryAccessKey: input.primaryModel?.tokenId ?? null,
    fallbackAccessKey: input.fallbackModel?.tokenId ?? null,
  };

  await (await getIntelligenceDbPool()).query(
    `
      INSERT INTO "intelligence_access" (id, account_id, key_hash, type, available_to, details, max_tokens, status)
      VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)
    `,
    [
      input.accessIdentifier,
      input.accountId,
      input.tokenHash,
      input.accessType,
      JSON.stringify([]),
      JSON.stringify(details),
      input.maxTokens,
      input.status,
    ]
  );

  return input.accessIdentifier;
}

export async function updateIntelligenceAccessRecord(input: {
  accessId: string;
  accountId: string;
  status: IntelligenceAccessStatus;
  accessType: IntelligenceAccessType;
  maxTokens: number | null;
  details: unknown;
  keyHash?: string;
}) {
  await (await getIntelligenceDbPool()).query(
    `
      UPDATE "intelligence_access"
      SET status = $1, type = $2, max_tokens = $3, details = $4::jsonb, key_hash = COALESCE($5, key_hash), updated_at = CURRENT_TIMESTAMP
      WHERE id = $6 AND account_id = $7
    `,
    [
      input.status,
      input.accessType,
      input.maxTokens,
      typeof input.details === 'string' ? input.details : JSON.stringify(input.details),
      input.keyHash ?? null,
      input.accessId,
      input.accountId,
    ]
  );
}

export async function deleteIntelligenceAccessRecord(input: { accessId: string; accountId: string }) {
  await (await getIntelligenceDbPool()).query(
    'DELETE FROM "intelligence_access" WHERE id = $1 AND account_id = $2',
    [input.accessId, input.accountId]
  );
}

export async function updateIntelligenceAccessStatus(input: {
  accessId: string;
  accountId: string;
  status: Exclude<IntelligenceAccessStatus, 'unpublished'>;
}) {
  await (await getIntelligenceDbPool()).query(
    'UPDATE "intelligence_access" SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND account_id = $3',
    [input.status, input.accessId, input.accountId]
  );
}

export async function rechargeIntelligenceAccessBalance(input: {
  accessId: string;
  accountId: string;
  amount: number;
}) {
  await (await getIntelligenceDbPool()).query(
    'UPDATE "intelligence_access" SET token_balance = token_balance + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND account_id = $3',
    [input.amount, input.accessId, input.accountId]
  );
}

export async function publishIntelligenceAccess(input: {
  accessId: string;
  accountId: string;
  accessKey: string;
  resetKey?: boolean;
  previousKey?: string;
}): Promise<{ newAccessKey: string }> {
  await updateIntelligenceAccessStatus({
    accessId: input.accessId,
    accountId: input.accountId,
    status: 'prod',
  });

  return { newAccessKey: input.accessKey };
}

function mapLogRow(row: {
  id: string | number;
  access_id: string;
  account_id: string | null;
  details: unknown;
  balance: number | null;
  logged_on: Date;
}): IntelligenceLogRecord {
  const details = asRecord(normalizeDetails(row.details));

  return {
    id: toNumber(row.id),
    access_id: String(row.access_id),
    account_id: row.account_id,
    query: typeof details.query === 'string' ? details.query : null,
    response: typeof details.response === 'string' ? details.response : null,
    context: typeof details.context === 'string' ? details.context : JSON.stringify(details.context ?? ''),
    modal: typeof details.modal === 'string' ? details.modal : null,
    currency: typeof details.currency === 'string' ? details.currency : null,
    cost: toNullableNumber(details.cost),
    inputTokens: toNullableNumber(details.inputTokens),
    outputTokens: toNullableNumber(details.outputTokens),
    balance: toNullableNumber(details.balance) ?? row.balance,
    logged_on: row.logged_on,
  };
}

export async function getIntelligenceLogs(accountId: string): Promise<IntelligenceLogRecord[]> {
  const result = await (await getIntelligenceDbPool()).query<{
    id: string | number;
    access_id: string;
    account_id: string | null;
    details: unknown;
    balance: number | null;
    logged_on: Date;
  }>(
    `
      SELECT il.id, il.access_id, ia.account_id, il.details, il.balance, il.logged_on
      FROM "intelligence_log" il
      JOIN "intelligence_access" ia ON ia.id = il.access_id
      WHERE ia.account_id = $1
      ORDER BY il.logged_on DESC
    `,
    [accountId]
  );

  return result.rows.map(mapLogRow);
}

export async function getPaginatedIntelligenceLogs(accountId: string, page = 1, pageSize = 10) {
  const safePage = Math.max(1, page);
  const offset = (safePage - 1) * pageSize;
  const db = await getIntelligenceDbPool();
  const [logsResult, countResult] = await Promise.all([
    db.query(
      `
        SELECT il.id, il.access_id, ia.account_id, il.details, il.balance, il.logged_on
        FROM "intelligence_log" il
        JOIN "intelligence_access" ia ON ia.id = il.access_id
        WHERE ia.account_id = $1
        ORDER BY il.logged_on DESC
        LIMIT $2 OFFSET $3
      `,
      [accountId, pageSize, offset]
    ),
    db.query<{ count: string }>(
      `
        SELECT COUNT(*)::TEXT AS count
        FROM "intelligence_log" il
        JOIN "intelligence_access" ia ON ia.id = il.access_id
        WHERE ia.account_id = $1
      `,
      [accountId]
    ),
  ]);

  const total = Number(countResult.rows[0]?.count || 0);

  return {
    logs: logsResult.rows.map(mapLogRow),
    currentPage: safePage,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function insertIntelligenceDevLog(input: {
  accountId: string | null;
  accessId: string | null;
  requestId: string;
  requestMethod: string;
  requestUrl: string;
  requestHeaders: Record<string, unknown>;
  requestBody: Record<string, unknown> | null;
  requestQuery: Record<string, string>;
  requestContext: Record<string, unknown> | null;
  responseStatus: number | null;
  responseBody: Record<string, unknown> | null;
  errorMessage: string | null;
  errorStack: string | null;
}) {
  await ensureIntelligenceTables();
  await (await getIntelligenceDbPool()).query(
    `
      INSERT INTO "intelligence_devlog" (
        account_id, access_id, request_id, request_method, request_url, request_headers,
        request_body, request_query, request_context, response_status, response_body,
        error_message, error_stack
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10, $11::jsonb, $12, $13)
    `,
    [
      input.accountId,
      input.accessId,
      input.requestId,
      input.requestMethod,
      input.requestUrl,
      JSON.stringify(input.requestHeaders),
      input.requestBody ? JSON.stringify(input.requestBody) : null,
      JSON.stringify(input.requestQuery),
      input.requestContext ? JSON.stringify(input.requestContext) : null,
      input.responseStatus,
      input.responseBody ? JSON.stringify(input.responseBody) : null,
      input.errorMessage,
      input.errorStack,
    ]
  );
}

export async function getPaginatedIntelligenceDevLogs(accountId: string, page = 1, pageSize = 10) {
  await ensureIntelligenceTables();
  const safePage = Math.max(1, page);
  const offset = (safePage - 1) * pageSize;
  const db = await getIntelligenceDbPool();
  const [logsResult, countResult] = await Promise.all([
    db.query<IntelligenceDevLogRecord>(
      `
        SELECT *
        FROM "intelligence_devlog"
        WHERE account_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `,
      [accountId, pageSize, offset]
    ),
    db.query<{ count: string }>(
      'SELECT COUNT(*)::TEXT AS count FROM "intelligence_devlog" WHERE account_id = $1',
      [accountId]
    ),
  ]);

  const total = Number(countResult.rows[0]?.count || 0);

  return {
    logs: logsResult.rows,
    currentPage: safePage,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
