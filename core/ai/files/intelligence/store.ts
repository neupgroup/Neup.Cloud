import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

import { ensureIntelligenceTables, getIntelligenceDbPool } from '@/core/ai/files/intelligence/db';

// Encryption helpers for keys in details
const ENCRYPTION_KEY = process.env.INTELLIGENCE_ENCRYPTION_KEY || 'default-key-change-in-production-32b';
const ALGORITHM = 'aes-256-cbc';

function encryptKey(key: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY).slice(0, 32), iv);
  let encrypted = cipher.update(key, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

function decryptKey(encryptedKey: string): string {
  const [ivHex, encrypted] = encryptedKey.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY).slice(0, 32), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Helper to build model string: "provider/model/encrypted_key/token_id"
export function buildModelString(provider: string, model: string, apiKey: string | null, tokenId: number | null): string {
  const encryptedKey = apiKey ? encryptKey(apiKey) : 'none';
  const tokenIdStr = tokenId ? String(tokenId) : 'none';
  return `${provider}/${model}/${encryptedKey}/${tokenIdStr}`;
}

// Helper to parse model string: "provider/model/encrypted_key/token_id"
export function parseModelString(modelStr: string): { provider: string; model: string; apiKey: string | null; tokenId: number | null } {
  const [provider, model, encryptedKey, tokenIdStr] = modelStr.split('/');
  return {
    provider,
    model,
    apiKey: encryptedKey !== 'none' ? decryptKey(encryptedKey) : null,
    tokenId: tokenIdStr !== 'none' ? parseInt(tokenIdStr, 10) : null,
  };
}

// Helper to build details object
export function buildDetailsObject(prompt: string | null, models: string[]): object {
  return {
    prompt: prompt || '',
    models,
  };
}

// Helper to parse details object
export function parseDetailsObject(details: unknown): { prompt: string | null; models: string[] } {
  if (!details || typeof details !== 'object') {
    return { prompt: null, models: [] };
  }
  const obj = details as Record<string, unknown>;
  return {
    prompt: typeof obj.prompt === 'string' ? obj.prompt : null,
    models: Array.isArray(obj.models) ? obj.models.filter((m): m is string => typeof m === 'string') : [],
  };
}

const intlWithSupportedValues = Intl as typeof Intl & {
  supportedValuesOf?: (key: string) => string[];
};

const supportedCurrencyCodes = new Set(
  typeof intlWithSupportedValues.supportedValuesOf === 'function'
    ? intlWithSupportedValues.supportedValuesOf('currency').map((value) => value.toUpperCase())
    : ['AED', 'AUD', 'BDT', 'BRL', 'CAD', 'CHF', 'CNY', 'DKK', 'EUR', 'GBP', 'HKD', 'IDR', 'INR', 'JPY', 'KRW', 'KWD', 'MXN', 'MYR', 'NOK', 'NPR', 'NZD', 'PHP', 'PKR', 'QAR', 'SAR', 'SEK', 'SGD', 'THB', 'TRY', 'USD', 'ZAR']
);

export interface AccessTokenRecord {
  id: number;
  account_id: string;
  name: string;
  key: string;
}

export interface IntelligenceModelRecord {
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

export type AccessType = 'open' | 'hybrid' | 'closed';

export interface IntelligenceAccessRecord {
  id: string;
  key_hash: string;
  type: AccessType;
  available_to: unknown;
  details: unknown;
  max_tokens: number | null;
  token_balance: number;
  status: string;
  updated_at: string;
}

export interface IntelligenceLogRecord {
  id: number;
  access_id: string;
  details: Record<string, unknown>;
  from: string | null;
  balance_used: number | null;
  dev_details?: Record<string, unknown> | null;
  logged_on: string;
  // Computed/helper properties for backwards compatibility
  inputTokens?: number;
  outputTokens?: number;
  cost?: number | null;
  currency?: string | null;
  query?: string;
  response?: string;
  context?: string;
  modal?: string;
}

export interface PaginatedIntelligenceLogsResult {
  logs: IntelligenceLogRecord[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

export interface IntelligenceDevLogRecord {
  id: number;
  account_id: string | null;
  access_id: string | null;
  request_id: string;
  request_method: string;
  request_url: string;
  request_headers: Record<string, unknown>;
  request_body: Record<string, unknown> | null;
  request_query: Record<string, string>;
  request_context: Record<string, unknown> | null;
  response_status: number | null;
  response_body: Record<string, unknown> | null;
  error_message: string | null;
  error_stack: string | null;
  created_at: string;
}

export interface PaginatedIntelligenceDevLogsResult {
  logs: IntelligenceDevLogRecord[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

export interface IntelligenceSettingsRecord {
  account_id: string;
  dev_mode: boolean;
}

interface AccessTokenRow {
  id: number | string;
  account_id: string;
  name: string;
  key: string;
}

interface IntelligenceAccessRow {
  id: string;
  key_hash: string;
  type: string;
  available_to: unknown;
  details: unknown;
  max_tokens: number | string | null;
  token_balance: number | string;
  status: string;
  updated_at: string;
}

interface IntelligenceLogRow {
  id: number | string;
  access_id: string;
  details: unknown;
  from: string | null;
  balance_used: number | string | null;
  dev_details?: unknown;
  logged_on: string;
}

interface IntelligenceSettingsRow {
  account_id: string;
  dev_mode: boolean;
}

export interface IntelligenceDevLogInput {
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
}

export function hashAccessToken(value: string): string {
  if (!value.trim()) {
    throw new Error('Access token cannot be empty');
  }

  if (value.startsWith('sha256:')) {
    return value;
  }

  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

export function generateAccessToken(): string {
  return `ncl_int_${randomBytes(24).toString('hex')}`;
}

export function generateAccessIdentifier(): string {
  return `acc_${randomBytes(10).toString('hex')}`;
}

export function maskSecret(value: string): string {
  if (!value) {
    return '';
  }

  if (value.length <= 8) {
    return `${value.slice(0, 2)}***`;
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function encryptValue(value: string, accessKey: string): string {
  if (!value.trim()) {
    return '';
  }

  const accessKeyHash = createHash('sha256').update(accessKey).digest('hex');
  const encrypted = value.split('').map((char, index) => {
    const keyChar = accessKeyHash[index % accessKeyHash.length];
    const encryptedChar = String.fromCharCode(char.charCodeAt(0) ^ keyChar.charCodeAt(0));
    return encryptedChar;
  }).join('');

  return `enc_${Buffer.from(encrypted, 'utf-8').toString('base64')}`;
}

export function decryptValue(encryptedValue: string, accessKey: string): string {
  if (!encryptedValue.trim() || !encryptedValue.startsWith('enc_')) {
    return encryptedValue;
  }

  try {
    const encrypted = Buffer.from(encryptedValue.substring(4), 'base64').toString('utf-8');
    const accessKeyHash = createHash('sha256').update(accessKey).digest('hex');
    const decrypted = encrypted.split('').map((char, index) => {
      const keyChar = accessKeyHash[index % accessKeyHash.length];
      const decryptedChar = String.fromCharCode(char.charCodeAt(0) ^ keyChar.charCodeAt(0));
      return decryptedChar;
    }).join('');

    return decrypted;
  } catch {
    return '';
  }
}

function normalizeNumericId(value: number | string | null | undefined): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return parsed;
}

function normalizeOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function getAccessTokens(accountId: string): Promise<AccessTokenRecord[]> {
  await ensureIntelligenceTables();
  const db = getIntelligenceDbPool();
  const result = await db.query<AccessTokenRow>(
    `
      SELECT id, account_id, name, "key"
      FROM "accessTokens"
      WHERE account_id = $1
      ORDER BY id DESC
    `,
    [accountId]
  );

  return result.rows.map((row) => ({
    id: normalizeNumericId(row.id),
    account_id: row.account_id,
    name: row.name,
    key: row.key,
  }));
}

export async function getAccessTokenById(accountId: string, tokenId: number): Promise<AccessTokenRecord | null> {
  await ensureIntelligenceTables();
  const db = getIntelligenceDbPool();
  const result = await db.query<AccessTokenRow>(
    `
      SELECT id, account_id, name, "key"
      FROM "accessTokens"
      WHERE account_id = $1 AND id = $2
      LIMIT 1
    `,
    [accountId, tokenId]
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    id: normalizeNumericId(row.id),
    account_id: row.account_id,
    name: row.name,
    key: row.key,
  };
}

export async function getIntelligenceModels(): Promise<IntelligenceModelRecord[]> {
  await ensureIntelligenceTables();
  const db = getIntelligenceDbPool();
  const result = await db.query<{
    id: number | string;
    title: string;
    provider: string;
    model: string;
    description: string | null;
    currency: string | null;
    inputPrice: number | string | null;
    outputPrice: number | string | null;
  }>(
    `
      SELECT id, title, provider, model, description, currency, "inputPrice", "outputPrice"
      FROM "intelligence_models"
      ORDER BY title ASC, provider ASC, model ASC
    `
  );

  return result.rows.map((row) => ({
    id: normalizeNumericId(row.id),
    title: row.title,
    provider: row.provider,
    model: row.model,
    description: row.description,
    currency: row.currency || 'USD',
    inputRate: `${normalizeOptionalNumber(row.inputPrice) ?? 0}/1000`,
    outputRate: `${normalizeOptionalNumber(row.outputPrice) ?? 0}/1000`,
    inputCostPer1000Tokens: normalizeOptionalNumber(row.inputPrice) ?? 0,
    outputCostPer1000Tokens: normalizeOptionalNumber(row.outputPrice) ?? 0,
  }));
}

export async function getIntelligenceModelById(modelId: number): Promise<IntelligenceModelRecord | null> {
  await ensureIntelligenceTables();
  const db = getIntelligenceDbPool();
  const result = await db.query<{
    id: number | string;
    title: string;
    provider: string;
    model: string;
    description: string | null;
    currency: string | null;
    inputPrice: number | string | null;
    outputPrice: number | string | null;
  }>(
    `
      SELECT id, title, provider, model, description, currency, "inputPrice", "outputPrice"
      FROM "intelligence_models"
      WHERE id = $1
      LIMIT 1
    `,
    [modelId]
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    id: normalizeNumericId(row.id),
    title: row.title,
    provider: row.provider,
    model: row.model,
    description: row.description,
    currency: row.currency || 'USD',
    inputRate: `${normalizeOptionalNumber(row.inputPrice) ?? 0}/1000`,
    outputRate: `${normalizeOptionalNumber(row.outputPrice) ?? 0}/1000`,
    inputCostPer1000Tokens: normalizeOptionalNumber(row.inputPrice) ?? 0,
    outputCostPer1000Tokens: normalizeOptionalNumber(row.outputPrice) ?? 0,
  };
}

export async function getIntelligenceAccesses(accountId: string): Promise<IntelligenceAccessRecord[]> {
  await ensureIntelligenceTables();
  const db = getIntelligenceDbPool();
  const result = await db.query<IntelligenceAccessRow>(
    `
      SELECT id, key_hash, type, available_to, details, max_tokens, token_balance, status, updated_at
      FROM "intelligence_access"
      WHERE account_id = $1
      ORDER BY created_at DESC
    `,
    [accountId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    key_hash: row.key_hash,
    type: row.type as AccessType,
    available_to: row.available_to,
    details: row.details,
    max_tokens: row.max_tokens === null ? null : normalizeNumericId(row.max_tokens),
    token_balance: row.token_balance === null ? 0 : Number(row.token_balance),
    status: row.status,
    updated_at: row.updated_at,
  }));
}

export async function getIntelligenceAccessById(accountId: string, accessId: string): Promise<IntelligenceAccessRecord | null> {
  await ensureIntelligenceTables();
  const db = getIntelligenceDbPool();
  const result = await db.query<IntelligenceAccessRow>(
    `
      SELECT id, key_hash, type, available_to, details, max_tokens, token_balance, status, updated_at
      FROM "intelligence_access"
      WHERE id = $1
      LIMIT 1
    `,
    [accessId]
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    key_hash: row.key_hash,
    type: row.type as AccessType,
    available_to: row.available_to,
    details: row.details,
    max_tokens: row.max_tokens === null ? null : normalizeNumericId(row.max_tokens),
    token_balance: row.token_balance === null ? 0 : Number(row.token_balance),
    status: row.status,
    updated_at: row.updated_at,
  };
}

export async function getIntelligenceAccessByHash(accountId: string, keyHash: string): Promise<IntelligenceAccessRecord | null> {
  await ensureIntelligenceTables();
  const db = getIntelligenceDbPool();
  const result = await db.query<IntelligenceAccessRow>(
    `
      SELECT id, key_hash, type, available_to, details, max_tokens, token_balance, status, updated_at
      FROM "intelligence_access"
      WHERE key_hash = $1
      LIMIT 1
    `,
    [keyHash]
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    key_hash: row.key_hash,
    type: row.type as AccessType,
    available_to: row.available_to,
    details: row.details,
    max_tokens: row.max_tokens === null ? null : normalizeNumericId(row.max_tokens),
    token_balance: row.token_balance === null ? 0 : Number(row.token_balance),
    status: row.status,
    updated_at: row.updated_at,
  };
}

export async function getIntelligenceLogs(accountId: string): Promise<IntelligenceLogRecord[]> {
  await ensureIntelligenceTables();
  const db = getIntelligenceDbPool();
  const result = await db.query<IntelligenceLogRow>(
    `
      SELECT
        il.id,
        il.access_id,
        il.details,
        il."from",
        il.balance_used,
        il.dev_details,
        il.logged_on
      FROM "intelligence_log" il
      INNER JOIN "intelligence_access" ia
        ON ia.id = il.access_id
      WHERE ia.account_id = $1
      ORDER BY il.id DESC
    `,
    [accountId]
  );

  return result.rows.map((row) => ({
    id: normalizeNumericId(row.id),
    access_id: row.access_id,
    details: row.details,
    from: row.from,
    balance_used: row.balance_used === null ? null : Number(row.balance_used),
    dev_details: row.dev_details as Record<string, unknown> | null | undefined,
    logged_on: row.logged_on,
    // Extract commonly used fields from details for backwards compatibility
    inputTokens: typeof row.details === 'object' && row.details !== null ? (row.details as Record<string, unknown>).inputTokens as number : undefined,
    outputTokens: typeof row.details === 'object' && row.details !== null ? (row.details as Record<string, unknown>).outputTokens as number : undefined,
    cost: typeof row.details === 'object' && row.details !== null ? (row.details as Record<string, unknown>).cost as number | null : undefined,
    currency: typeof row.details === 'object' && row.details !== null ? (row.details as Record<string, unknown>).currency as string | null : undefined,
    query: typeof row.details === 'object' && row.details !== null ? (row.details as Record<string, unknown>).query as string : undefined,
    response: typeof row.details === 'object' && row.details !== null ? (row.details as Record<string, unknown>).response as string : undefined,
    context: typeof row.details === 'object' && row.details !== null ? (row.details as Record<string, unknown>).context as string : undefined,
    modal: typeof row.details === 'object' && row.details !== null ? (row.details as Record<string, unknown>).modal as string : undefined,
  }));
}

export async function getPaginatedIntelligenceLogs(
  accountId: string,
  page: number,
  pageSize: number
): Promise<PaginatedIntelligenceLogsResult> {
  await ensureIntelligenceTables();
  const db = getIntelligenceDbPool();
  const requestedPage = Math.max(1, Math.trunc(page || 1));
  const normalizedPageSize = Math.max(1, Math.trunc(pageSize || 10));
  const countResult = await db.query<{ count: string }>(
    `
      SELECT COUNT(*)::text AS count
      FROM "intelligence_log" il
      INNER JOIN "intelligence_access" ia
        ON ia.id = il.access_id
      WHERE ia.account_id = $1
    `,
    [accountId]
  );

  const totalCount = Number(countResult.rows[0]?.count || 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / normalizedPageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const offset = (currentPage - 1) * normalizedPageSize;
  const logsResult = await db.query<IntelligenceLogRow>(
    `
      SELECT
        il.id,
        il.access_id,
        il.details,
        il."from",
        il.balance_used,
        il.dev_details,
        il.logged_on
      FROM "intelligence_log" il
      INNER JOIN "intelligence_access" ia
        ON ia.id = il.access_id
      WHERE ia.account_id = $1
      ORDER BY il.id DESC
      LIMIT $2
      OFFSET $3
    `,
    [accountId, normalizedPageSize, offset]
  );

  return {
    logs: logsResult.rows.map((row) => ({
      id: normalizeNumericId(row.id),
      access_id: row.access_id,
      details: row.details,
      from: row.from,
      balance_used: row.balance_used === null ? null : Number(row.balance_used),
      dev_details: row.dev_details as Record<string, unknown> | null | undefined,
      logged_on: row.logged_on,
      // Extract commonly used fields from details for backwards compatibility
      inputTokens: typeof row.details === 'object' && row.details !== null ? (row.details as Record<string, unknown>).inputTokens as number : undefined,
      outputTokens: typeof row.details === 'object' && row.details !== null ? (row.details as Record<string, unknown>).outputTokens as number : undefined,
      cost: typeof row.details === 'object' && row.details !== null ? (row.details as Record<string, unknown>).cost as number | null : undefined,
      currency: typeof row.details === 'object' && row.details !== null ? (row.details as Record<string, unknown>).currency as string | null : undefined,
      query: typeof row.details === 'object' && row.details !== null ? (row.details as Record<string, unknown>).query as string : undefined,
      response: typeof row.details === 'object' && row.details !== null ? (row.details as Record<string, unknown>).response as string : undefined,
      context: typeof row.details === 'object' && row.details !== null ? (row.details as Record<string, unknown>).context as string : undefined,
      modal: typeof row.details === 'object' && row.details !== null ? (row.details as Record<string, unknown>).modal as string : undefined,
    })),
    totalCount,
    totalPages,
    currentPage,
    pageSize: normalizedPageSize,
  };
}

export async function createAccessTokenRecord(input: {
  accountId: string;
  name: string;
  key: string;
}): Promise<void> {
  await ensureIntelligenceTables();
  const db = getIntelligenceDbPool();

  await db.query(
    `
      INSERT INTO "accessTokens" (account_id, name, "key")
      VALUES ($1, $2, $3)
    `,
    [input.accountId, input.name, input.key]
  );
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
}): Promise<void> {
  await ensureIntelligenceTables();
  const db = getIntelligenceDbPool();

  await db.query(
    `
      INSERT INTO "intelligence_models" (title, provider, model, description, currency, "inputPrice", "outputPrice")
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (provider, model)
      DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        currency = EXCLUDED.currency,
        "inputPrice" = EXCLUDED."inputPrice",
        "outputPrice" = EXCLUDED."outputPrice"
    `,
    [
      input.title,
      input.provider.trim().toLowerCase(),
      input.model.trim(),
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
  inputRate: string;
  outputRate: string;
  inputCostPer1000Tokens: number;
  outputCostPer1000Tokens: number;
}): Promise<void> {
  await ensureIntelligenceTables();
  const db = getIntelligenceDbPool();

  try {
    const result = await db.query(
      `
        UPDATE "intelligence_models"
        SET
          title = $1,
          provider = $2,
          model = $3,
          description = $4,
          currency = $5,
          "inputPrice" = $6,
          "outputPrice" = $7
        WHERE id = $8
      `,
      [
        input.title,
        input.provider.trim().toLowerCase(),
        input.model.trim(),
        input.description,
        input.currency,
        input.inputCostPer1000Tokens,
        input.outputCostPer1000Tokens,
        input.modelId,
      ]
    );

    if (result.rowCount === 0) {
      throw new Error('Model record not found');
    }
  } catch (error) {
    if ((error as { code?: string })?.code === '23505') {
      throw new Error('Another model already uses this provider and model pair');
    }

    throw error;
  }
}

export async function deleteIntelligenceModelRecord(input: {
  modelId: number;
}): Promise<void> {
  await ensureIntelligenceTables();
  const db = getIntelligenceDbPool();

  const result = await db.query(
    `
      DELETE FROM "intelligence_models"
      WHERE id = $1
    `,
    [input.modelId]
  );

  if (result.rowCount === 0) {
    throw new Error('Model record not found');
  }
}

export async function createIntelligenceAccessRecord(input: {
  accessIdentifier: string;
  accountId: string;
  tokenHash: string;
  status: 'dev' | 'prod' | 'hold' | 'unpublished';
  accessType: 'open' | 'hybrid' | 'closed';
  maxTokens: number | null;
  details: string[];
}): Promise<string> {
  await ensureIntelligenceTables();
  const db = getIntelligenceDbPool();

  const result = await db.query<{ id: string }>(
    `
      INSERT INTO "intelligence_access" (
        id,
        account_id,
        key_hash,
        type,
        available_to,
        details,
        max_tokens,
        token_balance,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `,
    [
      input.accessIdentifier,
      input.accountId,
      input.tokenHash,
      input.accessType,
      [],
      JSON.stringify(input.details),
      input.maxTokens,
      0,
      input.status,
    ]
  );

  return result.rows[0].id;
}

export async function updateIntelligenceAccessRecord(input: {
  accessId: string;
  accountId: string;
  status: 'dev' | 'prod' | 'hold';
  accessType: 'open' | 'hybrid' | 'closed';
  maxTokens: number | null;
  details: unknown;
}): Promise<void> {
  await ensureIntelligenceTables();
  const db = getIntelligenceDbPool();

  const existing = await getIntelligenceAccessById(input.accountId, input.accessId);

  if (!existing) {
    throw new Error('Access record not found');
  }

  await db.query(
    `
      UPDATE "intelligence_access"
      SET
        type = $1,
        details = $2,
        max_tokens = $3,
        status = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5 AND account_id = $6
    `,
    [
      input.accessType,
      input.details,
      input.maxTokens,
      input.status,
      input.accessId,
      input.accountId,
    ]
  );
}

export async function deleteIntelligenceAccessRecord(input: {
  accessId: string;
  accountId: string;
}): Promise<void> {
  await ensureIntelligenceTables();
  const db = getIntelligenceDbPool();

  const result = await db.query(
    `
      DELETE FROM "intelligence_access"
      WHERE id = $1 AND account_id = $2
    `,
    [input.accessId, input.accountId]
  );

  if (result.rowCount === 0) {
    throw new Error('Access record not found');
  }
}

export async function rechargeIntelligenceAccessBalance(input: {
  accessId: string;
  accountId: string;
  amount: number;
}): Promise<void> {
  await ensureIntelligenceTables();
  const db = getIntelligenceDbPool();

  const result = await db.query(
    `
      UPDATE "intelligence_access"
      SET
        token_balance = token_balance + $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND account_id = $3
    `,
    [input.amount, input.accessId, input.accountId]
  );

  if (result.rowCount === 0) {
    throw new Error('Access record not found');
  }
}

export async function logIntelligenceUsage(input: {
  accessId: string;
  details: Record<string, unknown>;
  from: string | null;
  balanceUsed: number;
  devDetails?: Record<string, unknown> | null;
}): Promise<void> {
  await ensureIntelligenceTables();
  const db = getIntelligenceDbPool();

  await db.query(
    `
      INSERT INTO "intelligence_log" (
        access_id,
        details,
        "from",
        balance_used,
        dev_details
      )
      VALUES ($1, $2, $3, $4, $5)
    `,
    [input.accessId, input.details, input.from, input.balanceUsed, input.devDetails || null]
  );
}

export async function deductBalance(input: {
  accessId: string;
  amount: number;
}): Promise<void> {
  await ensureIntelligenceTables();
  const db = getIntelligenceDbPool();

  await db.query(
    `
      UPDATE "intelligence_access"
      SET
        token_balance = token_balance - $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `,
    [input.amount, input.accessId]
  );
}

export async function getIntelligenceSettings(accountId: string): Promise<IntelligenceSettingsRecord | null> {
  await ensureIntelligenceTables();
  const db = getIntelligenceDbPool();
  const result = await db.query<IntelligenceSettingsRow>(
    `
      SELECT account_id, dev_mode
      FROM "intelligence_settings"
      WHERE account_id = $1
      LIMIT 1
    `,
    [accountId]
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    account_id: row.account_id,
    dev_mode: row.dev_mode,
  };
}

export async function updateIntelligenceSettings(accountId: string, devMode: boolean): Promise<void> {
  await ensureIntelligenceTables();
  const db = getIntelligenceDbPool();

  await db.query(
    `
      INSERT INTO "intelligence_settings" (account_id, dev_mode)
      VALUES ($1, $2)
      ON CONFLICT (account_id)
      DO UPDATE SET dev_mode = EXCLUDED.dev_mode
    `,
    [accountId, devMode]
  );
}

export async function createIntelligenceDevLog(input: IntelligenceDevLogInput): Promise<void> {
  await ensureIntelligenceTables();
  const db = getIntelligenceDbPool();

  await db.query(
    `
      INSERT INTO "intelligence_devlog" (
        account_id,
        access_id,
        request_id,
        request_method,
        request_url,
        request_headers,
        request_body,
        request_query,
        request_context,
        response_status,
        response_body,
        error_message,
        error_stack
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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

// Alias for backwards compatibility
export const insertIntelligenceDevLog = createIntelligenceDevLog;

export function parseLogContext(contextString: string | undefined | null): {
  guider: string;
  query: string;
  displayContext: string;
  currency: string | null;
} {
  if (!contextString) {
    return { guider: '', query: '', displayContext: '', currency: null };
  }

  try {
    const parsed = JSON.parse(contextString);
    return {
      guider: parsed.masterPrompt || parsed.guider || '',
      query: parsed.query || '',
      displayContext: typeof parsed.context === 'string' ? parsed.context : JSON.stringify(parsed.context || ''),
      currency: parsed.currency || null,
    };
  } catch {
    return { guider: '', query: '', displayContext: contextString, currency: null };
  }
}

export async function getPaginatedIntelligenceDevLogs(
  accountId: string,
  page: number,
  pageSize: number
): Promise<PaginatedIntelligenceDevLogsResult> {
  await ensureIntelligenceTables();
  const db = getIntelligenceDbPool();
  const requestedPage = Math.max(1, Math.trunc(page || 1));
  const normalizedPageSize = Math.max(1, Math.trunc(pageSize || 10));
  const countResult = await db.query<{ count: string }>(
    `
      SELECT COUNT(*)::text AS count
      FROM "intelligence_devlog"
      WHERE account_id = $1
    `,
    [accountId]
  );

  const totalCount = Number(countResult.rows[0]?.count || 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / normalizedPageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const offset = (currentPage - 1) * normalizedPageSize;

  const result = await db.query<IntelligenceDevLogRow>(
    `
      SELECT
        id,
        account_id,
        access_id,
        request_id,
        request_method,
        request_url,
        request_headers,
        request_body,
        request_query,
        request_context,
        response_status,
        response_body,
        error_message,
        error_stack,
        created_at
      FROM "intelligence_devlog"
      WHERE account_id = $1
      ORDER BY id DESC
      LIMIT $2
      OFFSET $3
    `,
    [accountId, normalizedPageSize, offset]
  );

  return {
    logs: result.rows.map((row) => ({
      id: normalizeNumericId(row.id),
      account_id: row.account_id,
      access_id: row.access_id,
      request_id: row.request_id,
      request_method: row.request_method,
      request_url: row.request_url,
      request_headers: row.request_headers,
      request_body: row.request_body,
      request_query: row.request_query,
      request_context: row.request_context,
      response_status: row.response_status === null ? null : Number(row.response_status),
      response_body: row.response_body,
      error_message: row.error_message,
      error_stack: row.error_stack,
      created_at: row.created_at,
    })),
    totalCount,
    totalPages,
    currentPage,
    pageSize: normalizedPageSize,
  };
}

// Helper functions for parsing form data
function parseRequiredString(value: FormDataEntryValue | null, fieldName: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${fieldName} is required`);
  }
  return value.trim();
}

function parseOptionalString(value: FormDataEntryValue | null): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function parseRequiredInteger(value: FormDataEntryValue | null, fieldName: string): number {
  const str = parseRequiredString(value, fieldName);
  const num = parseInt(str, 10);
  if (isNaN(num)) {
    throw new Error(`${fieldName} must be a valid integer`);
  }
  return num;
}

function parseOptionalInteger(value: FormDataEntryValue | null): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }
  const num = parseInt(trimmed, 10);
  return isNaN(num) ? null : num;
}

function parseRequiredDecimal(value: FormDataEntryValue | null, fieldName: string): number {
  const str = parseRequiredString(value, fieldName);
  const num = parseFloat(str);
  if (isNaN(num)) {
    throw new Error(`${fieldName} must be a valid number`);
  }
  return num;
}

function parseRateToPer1000(value: FormDataEntryValue | null, fieldName: string): number {
  const num = parseRequiredDecimal(value, fieldName);
  if (num < 0) {
    throw new Error(`${fieldName} must be non-negative`);
  }
  return num;
}

function parseCurrency(value: FormDataEntryValue | null): string {
  const currency = parseOptionalString(value);
  if (!currency) {
    return 'USD';
  }
  const upperCurrency = currency.toUpperCase();
  // You can add currency validation here if needed
  return upperCurrency;
}

export function parseTokenFormData(formData: FormData) {
  return {
    name: parseRequiredString(formData.get('name'), 'Token name'),
    key: parseRequiredString(formData.get('key'), 'Token key'),
  };
}

export function parseModelFormData(formData: FormData) {
  const provider = parseRequiredString(formData.get('provider'), 'Provider').toLowerCase();
  const inputRate = parseRateToPer1000(formData.get('input_rate'), 'Input rate');
  const outputRate = parseRateToPer1000(formData.get('output_rate'), 'Output rate');

  if (!['openai', 'anthropic', 'google', 'nvidia'].includes(provider)) {
    throw new Error('Provider must be one of: openai, anthropic, google, nvidia');
  }

  return {
    title: parseRequiredString(formData.get('title'), 'Title'),
    provider,
    model: parseRequiredString(formData.get('model'), 'Model'),
    description: parseOptionalString(formData.get('description')),
    currency: parseCurrency(formData.get('currency')),
    inputRate: inputRate.rate,
    outputRate: outputRate.rate,
    inputCostPer1000Tokens: inputRate.costPer1000Tokens,
    outputCostPer1000Tokens: outputRate.costPer1000Tokens,
  };
}

export function parseModelIdFormData(formData: FormData) {
  return parseRequiredInteger(formData.get('model_id'), 'Model ID');
}

export function parseAccessFormData(formData: FormData) {
  const primaryModelId = parseOptionalInteger(formData.get('primary_model_id'));
  const fallbackModelId = parseOptionalInteger(formData.get('fallback_model_id'));
  const primaryAccessKey = parseOptionalInteger(formData.get('primary_access_key'));
  const fallbackAccessKey = parseOptionalInteger(formData.get('fallback_access_key'));
  const maxTokens = parseOptionalInteger(formData.get('max_tokens'));
  const prompt = parseOptionalString(formData.get('prompt') ?? formData.get('def_prompt'));

  const accessType = parseOptionalString(formData.get('access_type')) || 'open';

  if (!['open', 'hybrid', 'closed'].includes(accessType)) {
    throw new Error('Access type must be one of: open, hybrid, closed');
  }

  const status = parseOptionalString(formData.get('access_status')) || 'prod';

  if (!['dev', 'prod', 'hold', 'unpublished'].includes(status)) {
    throw new Error('Access status must be one of: dev, prod, hold, unpublished');
  }

  return {
    accessType: accessType as 'open' | 'hybrid' | 'closed',
    status: status as 'dev' | 'prod' | 'hold' | 'unpublished',
    primaryModelId,
    fallbackModelId,
    primaryAccessKey,
    fallbackAccessKey,
    maxTokens,
    prompt,
  };
}

export function parseRechargeFormData(formData: FormData) {
  const amount = parseRequiredDecimal(formData.get('amount'), 'Recharge amount');

  if (amount <= 0) {
    throw new Error('Recharge amount must be greater than zero');
  }

  return {
    accessId: parseRequiredString(formData.get('access_id'), 'Access ID'),
    amount,
  };
}

export function parseAccessIdFormData(formData: FormData) {
  return parseRequiredString(formData.get('access_id'), 'Access ID');
}

export async function publishIntelligenceAccess(input: {
  accessId: string;
  accountId: string;
  accessKey: string;
  resetKey?: boolean;
  previousKey?: string;
}): Promise<{ newTokenHash: string; newAccessKey: string }> {
  await ensureIntelligenceTables();
  const db = getIntelligenceDbPool();

  // Get the access record
  const access = await getIntelligenceAccessById(input.accountId, input.accessId);

  if (!access) {
    throw new Error('Access record not found');
  }

  // Parse details array
  const details = Array.isArray(access.details) ? access.details : [];

  if (details.length === 0) {
    throw new Error('No details to publish');
  }

  // If not resetting key, verify the previous key
  if (!input.resetKey && input.previousKey) {
    const previousHash = hashAccessToken(input.previousKey);
    if (previousHash !== access.key_hash) {
      throw new Error('Invalid previous access key');
    }
  }

  // Generate new access key if resetting, otherwise use the provided one
  const newAccessKey = input.resetKey ? generateAccessToken() : input.accessKey;
  const newTokenHash = hashAccessToken(newAccessKey);

  // Process details array to encrypt keys
  const updatedDetails: string[] = [];

  for (const detail of details) {
    if (!detail || detail === '') {
      updatedDetails.push(detail);
      continue;
    }

    // Check if it's a model string (provider/model/0/tokenId)
    if (detail.includes('/')) {
      const parts = detail.split('/');
      if (parts.length === 4) {
        const [provider, model, keyPlaceholder, tokenIdStr] = parts;
        const tokenId = parseInt(tokenIdStr, 10);

        if (keyPlaceholder === '0' && tokenId > 0) {
          // Get the API key from accessTokens table
          const token = await getAccessTokenById(input.accountId, tokenId);
          if (!token) {
            throw new Error(`Token with ID ${tokenId} not found`);
          }

          // Encrypt the API key using the new access key
          const encryptedKey = encryptValue(token.key, newAccessKey);

          // Update the detail with encrypted key
          updatedDetails.push(`${provider}/${model}/${encryptedKey}/${tokenId}`);
        } else {
          // Already published or no token, keep as is
          updatedDetails.push(detail);
        }
      } else {
        updatedDetails.push(detail);
      }
    } else {
      // It's a prompt or other string, keep as is
      updatedDetails.push(detail);
    }
  }

  // Update the access record with new token hash, encrypted details, and status
  await db.query(
    `
      UPDATE "intelligence_access"
      SET
        key_hash = $1,
        details = $2,
        status = 'prod',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3 AND account_id = $4
    `,
    [newTokenHash, JSON.stringify(updatedDetails), input.accessId, input.accountId]
  );

  return {
    newTokenHash,
    newAccessKey,
  };
}

export function parseDetailsArray(details: unknown): string[] {
  if (!details) {
    return [];
  }
  if (Array.isArray(details)) {
    return details.filter((item): item is string => typeof item === 'string');
  }
  return [];
}

export function isAccessPublished(details: unknown): boolean {
  const detailsArray = parseDetailsArray(details);
  if (detailsArray.length === 0) {
    return false;
  }

  // Check if any model string has '0' as the key placeholder
  for (const detail of detailsArray) {
    if (detail && detail.includes('/')) {
      const parts = detail.split('/');
      if (parts.length === 4 && parts[2] === '0') {
        return false; // Has unpublished key
      }
    }
  }

  return true;
}
