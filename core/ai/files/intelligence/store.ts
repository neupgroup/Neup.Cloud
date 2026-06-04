import { createHash, randomBytes } from 'node:crypto';

import { ensureIntelligenceTables, getIntelligenceDbPool } from '@/core/ai/files/intelligence/db';

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
  price: Record<string, unknown>;
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
  id: number;
  prompt_id: string;
  account_id: string;
  token_hash: string;
  primaryModel: string | null;
  fallbackModel: string | null;
  primaryModelConfig: StoredModelConfig | null;
  fallbackModelConfig: StoredModelConfig | null;
  primaryAccessKey: number | null;
  fallbackAccessKey: number | null;
  primaryAccessTokenName: string | null;
  fallbackAccessTokenName: string | null;
  maxTokens: number | null;
  defPrompt: string | null;
  balance: number;
}

export interface IntelligenceLogRecord {
  id: number;
  access_id: number;
  query: string | null;
  response: string | null;
  context: string | null;
  modal: string | null;
  currency: string | null;
  cost: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  balance: number | null;
  prompt_id: string;
  account_id: string;
}

export interface PaginatedIntelligenceLogsResult {
  logs: IntelligenceLogRecord[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

interface IntelligenceModelRow {
  id: number | string;
  title: string;
  provider: string;
  model: string;
  description: string | null;
  currency: string | null;
  rate: string | null;
  costPer1000Tokens: number | string | null;
  inputPrice: number | string | null;
  outputPrice: number | string | null;
  price: unknown;
}

interface AccessTokenRow {
  id: number | string;
  account_id: string;
  name: string;
  key: string;
}

interface IntelligenceAccessRow {
  id: number | string;
  prompt_id: string;
  account_id: string;
  token_hash: string;
  primaryModel: string | null;
  fallbackModel: string | null;
  primaryModelConfig: unknown;
  fallbackModelConfig: unknown;
  primaryAccessKey: number | string | null;
  fallbackAccessKey: number | string | null;
  primaryAccessTokenName: string | null;
  fallbackAccessTokenName: string | null;
  maxTokens: number | null;
  defPrompt: string | null;
  balance: number;
}

interface IntelligenceLogRow {
  id: number | string;
  access_id: number | string;
  query: string | null;
  response: string | null;
  context: string | null;
  modal: string | null;
  currency: string | null;
  cost: number | string | null;
  inputTokens: number | string | null;
  outputTokens: number | string | null;
  balance: number | null;
  prompt_id: string;
  account_id: string;
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

function parseOptionalString(value: FormDataEntryValue | null): string | null {
  const normalized = String(value || '').trim();
  return normalized ? normalized : null;
}

function parseRequiredString(value: FormDataEntryValue | null, label: string): string {
  const normalized = String(value || '').trim();

  if (!normalized) {
    throw new Error(`${label} is required`);
  }

  return normalized;
}

function parseOptionalInteger(value: FormDataEntryValue | null): number | null {
  const normalized = String(value || '').trim();

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    throw new Error('Expected a valid number');
  }

  return Math.trunc(parsed);
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

function parseRequiredInteger(value: FormDataEntryValue | null, label: string): number {
  const parsed = parseOptionalInteger(value);

  if (parsed === null) {
    throw new Error(`${label} is required`);
  }

  return parsed;
}

function parseRequiredDecimal(value: FormDataEntryValue | null, label: string): number {
  const normalized = String(value || '').trim();

  if (!normalized) {
    throw new Error(`${label} is required`);
  }

  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be a valid number`);
  }

  return parsed;
}

function parseCurrency(value: FormDataEntryValue | null): string {
  const normalized = parseRequiredString(value, 'Currency').toUpperCase();

  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new Error('Currency must be a 3-letter code like USD');
  }

  if (!supportedCurrencyCodes.has(normalized)) {
    throw new Error(`Currency "${normalized}" is not recognized`);
  }

  return normalized;
}

function parseRateToPer1000(
  value: FormDataEntryValue | null,
  label: string
): { rate: string; costPer1000Tokens: number } {
  const normalized = parseRequiredString(value, label);
  const fractionMatch = normalized.match(/^\s*([0-9]*\.?[0-9]+)\s*\/\s*([0-9]*\.?[0-9]+)\s*$/);

  if (fractionMatch) {
    const numerator = Number(fractionMatch[1]);
    const denominator = Number(fractionMatch[2]);

    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
      throw new Error(`${label} must be a valid fraction like 1.23/10000000`);
    }

    return {
      rate: `${numerator}/${denominator}`,
      costPer1000Tokens: Number(((numerator / denominator) * 1000).toFixed(12)),
    };
  }

  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be a valid number or fraction`);
  }

  return {
    rate: normalized,
    costPer1000Tokens: parsed,
  };
}

function readPriceString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
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

function normalizeModelPrice(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function normalizeStoredModelConfig(value: unknown): StoredModelConfig | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = Number(record.id);
  const title = typeof record.title === 'string' ? record.title : '';
  const provider = typeof record.provider === 'string' ? record.provider : '';
  const model = typeof record.model === 'string' ? record.model : '';

  if (!title || !provider || !model) {
    return null;
  }

  return {
    id: Number.isFinite(id) ? id : 0,
    title,
    provider,
    model,
    description: typeof record.description === 'string' ? record.description : null,
    currency:
      typeof record.currency === 'string' && record.currency.trim()
        ? record.currency.trim().toUpperCase()
        : 'USD',
    inputRate:
      readPriceString(record, ['inputRate']) ||
      (typeof record.rate === 'string' && record.rate.trim() ? record.rate.trim() : '0/1000'),
    outputRate:
      readPriceString(record, ['outputRate']) ||
      (typeof record.rate === 'string' && record.rate.trim() ? record.rate.trim() : '0/1000'),
    inputCostPer1000Tokens:
      normalizeOptionalNumber(record.inputCostPer1000Tokens) ??
      normalizeOptionalNumber(record.inputPrice) ??
      normalizeOptionalNumber(record.costPer1000Tokens) ??
      0,
    outputCostPer1000Tokens:
      normalizeOptionalNumber(record.outputCostPer1000Tokens) ??
      normalizeOptionalNumber(record.outputPrice) ??
      normalizeOptionalNumber(record.costPer1000Tokens) ??
      0,
    price: normalizeModelPrice(record.price),
  };
}

function toModelIdentifier(model: Pick<StoredModelConfig, 'provider' | 'model'>): string {
  return `${model.provider}:${model.model}`;
}

export async function getIntelligenceModels(): Promise<IntelligenceModelRecord[]> {
  await ensureIntelligenceTables();
  const db = getIntelligenceDbPool();
  const result = await db.query<IntelligenceModelRow>(
    `
      SELECT id, title, provider, model, description, currency, rate, "costPer1000Tokens", "inputPrice", "outputPrice", price
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
    inputRate:
      readPriceString(normalizeModelPrice(row.price), ['inputRate']) ||
      row.rate ||
      '0/1000',
    outputRate:
      readPriceString(normalizeModelPrice(row.price), ['outputRate']) ||
      row.rate ||
      '0/1000',
    inputCostPer1000Tokens:
      normalizeOptionalNumber((normalizeModelPrice(row.price) as Record<string, unknown>).inputCostPer1000Tokens) ??
      normalizeOptionalNumber(row.inputPrice) ??
      normalizeOptionalNumber(row.costPer1000Tokens) ??
      0,
    outputCostPer1000Tokens:
      normalizeOptionalNumber((normalizeModelPrice(row.price) as Record<string, unknown>).outputCostPer1000Tokens) ??
      normalizeOptionalNumber(row.outputPrice) ??
      normalizeOptionalNumber(row.costPer1000Tokens) ??
      0,
    price: normalizeModelPrice(row.price),
  }));
}

export async function getIntelligenceModelById(modelId: number): Promise<IntelligenceModelRecord | null> {
  await ensureIntelligenceTables();
  const db = getIntelligenceDbPool();
  const result = await db.query<IntelligenceModelRow>(
    `
      SELECT id, title, provider, model, description, currency, rate, "costPer1000Tokens", "inputPrice", "outputPrice", price
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
    inputRate:
      readPriceString(normalizeModelPrice(row.price), ['inputRate']) ||
      row.rate ||
      '0/1000',
    outputRate:
      readPriceString(normalizeModelPrice(row.price), ['outputRate']) ||
      row.rate ||
      '0/1000',
    inputCostPer1000Tokens:
      normalizeOptionalNumber((normalizeModelPrice(row.price) as Record<string, unknown>).inputCostPer1000Tokens) ??
      normalizeOptionalNumber(row.inputPrice) ??
      normalizeOptionalNumber(row.costPer1000Tokens) ??
      0,
    outputCostPer1000Tokens:
      normalizeOptionalNumber((normalizeModelPrice(row.price) as Record<string, unknown>).outputCostPer1000Tokens) ??
      normalizeOptionalNumber(row.outputPrice) ??
      normalizeOptionalNumber(row.costPer1000Tokens) ??
      0,
    price: normalizeModelPrice(row.price),
  };
}

export async function getIntelligenceAccesses(accountId: string): Promise<IntelligenceAccessRecord[]> {
  await ensureIntelligenceTables();
  const db = getIntelligenceDbPool();
  const result = await db.query<IntelligenceAccessRow>(
    `
      SELECT
        ia.id,
        ia.prompt_id,
        ia.account_id,
        ia.token_hash,
        ia."primaryModel",
        ia."fallbackModel",
        ia."primaryModelConfig",
        ia."fallbackModelConfig",
        ia."primaryAccessKey",
        ia."fallbackAccessKey",
        primary_token.name AS "primaryAccessTokenName",
        fallback_token.name AS "fallbackAccessTokenName",
        ia."maxTokens",
        ia."defPrompt",
        ia.balance
      FROM "intelligenceAccess" ia
      LEFT JOIN "accessTokens" primary_token
        ON primary_token.id = ia."primaryAccessKey"
      LEFT JOIN "accessTokens" fallback_token
        ON fallback_token.id = ia."fallbackAccessKey"
      WHERE ia.account_id = $1
      ORDER BY ia.id DESC
    `,
    [accountId]
  );

  return result.rows.map((row) => ({
    ...row,
    id: normalizeNumericId(row.id),
    primaryAccessKey: row.primaryAccessKey === null ? null : normalizeNumericId(row.primaryAccessKey),
    fallbackAccessKey: row.fallbackAccessKey === null ? null : normalizeNumericId(row.fallbackAccessKey),
    primaryModelConfig: normalizeStoredModelConfig(row.primaryModelConfig),
    fallbackModelConfig: normalizeStoredModelConfig(row.fallbackModelConfig),
  }));
}

export async function getIntelligenceAccessById(
  accountId: string,
  accessId: number
): Promise<IntelligenceAccessRecord | null> {
  await ensureIntelligenceTables();
  const db = getIntelligenceDbPool();
  const result = await db.query<IntelligenceAccessRow>(
    `
      SELECT
        ia.id,
        ia.prompt_id,
        ia.account_id,
        ia.token_hash,
        ia."primaryModel",
        ia."fallbackModel",
        ia."primaryModelConfig",
        ia."fallbackModelConfig",
        ia."primaryAccessKey",
        ia."fallbackAccessKey",
        primary_token.name AS "primaryAccessTokenName",
        fallback_token.name AS "fallbackAccessTokenName",
        ia."maxTokens",
        ia."defPrompt",
        ia.balance
      FROM "intelligenceAccess" ia
      LEFT JOIN "accessTokens" primary_token
        ON primary_token.id = ia."primaryAccessKey"
      LEFT JOIN "accessTokens" fallback_token
        ON fallback_token.id = ia."fallbackAccessKey"
      WHERE ia.account_id = $1 AND ia.id = $2
      LIMIT 1
    `,
    [accountId, accessId]
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    ...row,
    id: normalizeNumericId(row.id),
    primaryAccessKey: row.primaryAccessKey === null ? null : normalizeNumericId(row.primaryAccessKey),
    fallbackAccessKey: row.fallbackAccessKey === null ? null : normalizeNumericId(row.fallbackAccessKey),
    primaryModelConfig: normalizeStoredModelConfig(row.primaryModelConfig),
    fallbackModelConfig: normalizeStoredModelConfig(row.fallbackModelConfig),
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
        il.query,
        il.response,
        il.context,
        il.modal,
        il.currency,
        il.cost,
        il."inputTokens",
        il."outputTokens",
        il.balance,
        ia.prompt_id,
        ia.account_id
      FROM "intelligenceLog" il
      INNER JOIN "intelligenceAccess" ia
        ON ia.id = il.access_id
      WHERE ia.account_id = $1
      ORDER BY il.id DESC
    `,
    [accountId]
  );

  return result.rows.map((row) => ({
    ...row,
    id: normalizeNumericId(row.id),
    access_id: normalizeNumericId(row.access_id),
    cost: normalizeOptionalNumber(row.cost),
    inputTokens: normalizeOptionalNumber(row.inputTokens),
    outputTokens: normalizeOptionalNumber(row.outputTokens),
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
      FROM "intelligenceLog" il
      INNER JOIN "intelligenceAccess" ia
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
        il.query,
        il.response,
        il.context,
        il.modal,
        il.currency,
        il.cost,
        il."inputTokens",
        il."outputTokens",
        il.balance,
        ia.prompt_id,
        ia.account_id
      FROM "intelligenceLog" il
      INNER JOIN "intelligenceAccess" ia
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
      ...row,
      id: normalizeNumericId(row.id),
      access_id: normalizeNumericId(row.access_id),
      cost: normalizeOptionalNumber(row.cost),
      inputTokens: normalizeOptionalNumber(row.inputTokens),
      outputTokens: normalizeOptionalNumber(row.outputTokens),
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
  const price = {
    currency: input.currency,
    inputRate: input.inputRate,
    outputRate: input.outputRate,
    inputCostPer1000Tokens: input.inputCostPer1000Tokens,
    outputCostPer1000Tokens: input.outputCostPer1000Tokens,
  };

  await db.query(
    `
      INSERT INTO "intelligence_models" (title, provider, model, description, currency, rate, "costPer1000Tokens", "inputPrice", "outputPrice", price)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
      ON CONFLICT (provider, model)
      DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        currency = EXCLUDED.currency,
        rate = EXCLUDED.rate,
        "costPer1000Tokens" = EXCLUDED."costPer1000Tokens",
        "inputPrice" = EXCLUDED."inputPrice",
        "outputPrice" = EXCLUDED."outputPrice",
        price = EXCLUDED.price
    `,
    [
      input.title,
      input.provider.trim().toLowerCase(),
      input.model.trim(),
      input.description,
      input.currency,
      input.inputRate,
      input.inputCostPer1000Tokens,
      input.inputCostPer1000Tokens,
      input.outputCostPer1000Tokens,
      JSON.stringify(price),
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
  const price = {
    currency: input.currency,
    inputRate: input.inputRate,
    outputRate: input.outputRate,
    inputCostPer1000Tokens: input.inputCostPer1000Tokens,
    outputCostPer1000Tokens: input.outputCostPer1000Tokens,
  };

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
          rate = $6,
          "costPer1000Tokens" = $7,
          "inputPrice" = $8,
          "outputPrice" = $9,
          price = $10::jsonb
        WHERE id = $11
      `,
      [
        input.title,
        input.provider.trim().toLowerCase(),
        input.model.trim(),
        input.description,
        input.currency,
        input.inputRate,
        input.inputCostPer1000Tokens,
        input.inputCostPer1000Tokens,
        input.outputCostPer1000Tokens,
        JSON.stringify(price),
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
  primaryModelId: number | null;
  fallbackModelId: number | null;
  primaryAccessKey: number | null;
  fallbackAccessKey: number | null;
  maxTokens: number | null;
  defPrompt: string | null;
}): Promise<void> {
  await ensureIntelligenceTables();
  const db = getIntelligenceDbPool();

  const tokenIds = Array.from(
    new Set([input.primaryAccessKey, input.fallbackAccessKey].filter((value): value is number => value !== null))
  );

  if (tokenIds.length > 0) {
    const tokenCheck = await db.query<{ id: number | string; account_id: string }>(
      `
        SELECT id, account_id
        FROM "accessTokens"
        WHERE id = ANY($1::bigint[])
      `,
      [tokenIds]
    );

    if (tokenCheck.rows.length !== tokenIds.length) {
      throw new Error('One or more selected access tokens do not exist');
    }

    const mismatched = tokenCheck.rows.find((row) => row.account_id !== input.accountId);
    if (mismatched) {
      throw new Error('Selected access tokens must belong to the same account_id as the access record');
    }
  }

  const modelIds = Array.from(
    new Set([input.primaryModelId, input.fallbackModelId].filter((value): value is number => value !== null))
  );
  let modelRows = new Map<number, StoredModelConfig>();

  if (modelIds.length > 0) {
    const modelResult = await db.query<IntelligenceModelRow>(
      `
        SELECT id, title, provider, model, description, currency, rate, "costPer1000Tokens", "inputPrice", "outputPrice", price
        FROM "intelligence_models"
        WHERE id = ANY($1::bigint[])
      `,
      [modelIds]
    );

    if (modelResult.rows.length !== modelIds.length) {
      throw new Error('One or more selected models do not exist');
    }

    modelRows = new Map(
      modelResult.rows.map((row) => [
        normalizeNumericId(row.id),
        {
          id: normalizeNumericId(row.id),
          title: row.title,
          provider: row.provider,
          model: row.model,
          description: row.description,
          currency: row.currency || 'USD',
          inputRate:
            readPriceString(normalizeModelPrice(row.price), ['inputRate']) ||
            row.rate ||
            '0/1000',
          outputRate:
            readPriceString(normalizeModelPrice(row.price), ['outputRate']) ||
            row.rate ||
            '0/1000',
          inputCostPer1000Tokens:
            normalizeOptionalNumber((normalizeModelPrice(row.price) as Record<string, unknown>).inputCostPer1000Tokens) ??
            normalizeOptionalNumber(row.inputPrice) ??
            normalizeOptionalNumber(row.costPer1000Tokens) ??
            0,
          outputCostPer1000Tokens:
            normalizeOptionalNumber((normalizeModelPrice(row.price) as Record<string, unknown>).outputCostPer1000Tokens) ??
            normalizeOptionalNumber(row.outputPrice) ??
            normalizeOptionalNumber(row.costPer1000Tokens) ??
            0,
          price: normalizeModelPrice(row.price),
        },
      ])
    );
  }

  const primaryModelConfig = input.primaryModelId !== null ? modelRows.get(input.primaryModelId) ?? null : null;
  const fallbackModelConfig = input.fallbackModelId !== null ? modelRows.get(input.fallbackModelId) ?? null : null;

  await db.query(
    `
      INSERT INTO "intelligenceAccess" (
        prompt_id,
        account_id,
        token_hash,
        "primaryModel",
        "fallbackModel",
        "primaryModelConfig",
        "fallbackModelConfig",
        "primaryAccessKey",
        "fallbackAccessKey",
        "maxTokens",
        "defPrompt",
        balance
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11, $12)
      ON CONFLICT (account_id, prompt_id)
      DO UPDATE SET
        token_hash = EXCLUDED.token_hash,
        "primaryModel" = EXCLUDED."primaryModel",
        "fallbackModel" = EXCLUDED."fallbackModel",
        "primaryModelConfig" = EXCLUDED."primaryModelConfig",
        "fallbackModelConfig" = EXCLUDED."fallbackModelConfig",
        "primaryAccessKey" = EXCLUDED."primaryAccessKey",
        "fallbackAccessKey" = EXCLUDED."fallbackAccessKey",
        "maxTokens" = EXCLUDED."maxTokens",
        "defPrompt" = EXCLUDED."defPrompt",
        balance = EXCLUDED.balance
    `,
    [
      input.accessIdentifier,
      input.accountId,
      input.tokenHash,
      primaryModelConfig ? toModelIdentifier(primaryModelConfig) : null,
      fallbackModelConfig ? toModelIdentifier(fallbackModelConfig) : null,
      primaryModelConfig ? JSON.stringify(primaryModelConfig) : null,
      fallbackModelConfig ? JSON.stringify(fallbackModelConfig) : null,
      input.primaryAccessKey,
      input.fallbackAccessKey,
      input.maxTokens,
      input.defPrompt,
      0,
    ]
  );
}

export async function updateIntelligenceAccessRecord(input: {
  accessId: number;
  accountId: string;
  primaryModelId: number | null;
  fallbackModelId: number | null;
  primaryAccessKey: number | null;
  fallbackAccessKey: number | null;
  maxTokens: number | null;
  defPrompt: string | null;
}): Promise<void> {
  await ensureIntelligenceTables();
  const db = getIntelligenceDbPool();

  const existing = await getIntelligenceAccessById(input.accountId, input.accessId);

  if (!existing) {
    throw new Error('Access record not found');
  }

  const tokenIds = Array.from(
    new Set([input.primaryAccessKey, input.fallbackAccessKey].filter((value): value is number => value !== null))
  );

  if (tokenIds.length > 0) {
    const tokenCheck = await db.query<{ id: number | string; account_id: string }>(
      `
        SELECT id, account_id
        FROM "accessTokens"
        WHERE id = ANY($1::bigint[])
      `,
      [tokenIds]
    );

    if (tokenCheck.rows.length !== tokenIds.length) {
      throw new Error('One or more selected access tokens do not exist');
    }

    const mismatched = tokenCheck.rows.find((row) => row.account_id !== input.accountId);
    if (mismatched) {
      throw new Error('Selected access tokens must belong to the same account_id as the access record');
    }
  }

  const modelIds = Array.from(
    new Set([input.primaryModelId, input.fallbackModelId].filter((value): value is number => value !== null))
  );
  let modelRows = new Map<number, StoredModelConfig>();

  if (modelIds.length > 0) {
    const modelResult = await db.query<IntelligenceModelRow>(
      `
        SELECT id, title, provider, model, description, currency, rate, "costPer1000Tokens", "inputPrice", "outputPrice", price
        FROM "intelligence_models"
        WHERE id = ANY($1::bigint[])
      `,
      [modelIds]
    );

    if (modelResult.rows.length !== modelIds.length) {
      throw new Error('One or more selected models do not exist');
    }

    modelRows = new Map(
      modelResult.rows.map((row) => [
        normalizeNumericId(row.id),
        {
          id: normalizeNumericId(row.id),
          title: row.title,
          provider: row.provider,
          model: row.model,
          description: row.description,
          currency: row.currency || 'USD',
          inputRate:
            readPriceString(normalizeModelPrice(row.price), ['inputRate']) ||
            row.rate ||
            '0/1000',
          outputRate:
            readPriceString(normalizeModelPrice(row.price), ['outputRate']) ||
            row.rate ||
            '0/1000',
          inputCostPer1000Tokens:
            normalizeOptionalNumber((normalizeModelPrice(row.price) as Record<string, unknown>).inputCostPer1000Tokens) ??
            normalizeOptionalNumber(row.inputPrice) ??
            normalizeOptionalNumber(row.costPer1000Tokens) ??
            0,
          outputCostPer1000Tokens:
            normalizeOptionalNumber((normalizeModelPrice(row.price) as Record<string, unknown>).outputCostPer1000Tokens) ??
            normalizeOptionalNumber(row.outputPrice) ??
            normalizeOptionalNumber(row.costPer1000Tokens) ??
            0,
          price: normalizeModelPrice(row.price),
        },
      ])
    );
  }

  const primaryModelConfig = input.primaryModelId !== null ? modelRows.get(input.primaryModelId) ?? null : null;
  const fallbackModelConfig = input.fallbackModelId !== null ? modelRows.get(input.fallbackModelId) ?? null : null;

  try {
    const result = await db.query(
      `
        UPDATE "intelligenceAccess"
        SET
          "primaryModel" = $1,
          "fallbackModel" = $2,
          "primaryModelConfig" = $3::jsonb,
          "fallbackModelConfig" = $4::jsonb,
          "primaryAccessKey" = $5,
          "fallbackAccessKey" = $6,
          "maxTokens" = $7,
          "defPrompt" = $8
        WHERE id = $9 AND account_id = $10
      `,
      [
        primaryModelConfig ? toModelIdentifier(primaryModelConfig) : null,
        fallbackModelConfig ? toModelIdentifier(fallbackModelConfig) : null,
        primaryModelConfig ? JSON.stringify(primaryModelConfig) : null,
        fallbackModelConfig ? JSON.stringify(fallbackModelConfig) : null,
        input.primaryAccessKey,
        input.fallbackAccessKey,
        input.maxTokens,
        input.defPrompt,
        input.accessId,
        input.accountId,
      ]
    );

    if (result.rowCount === 0) {
      throw new Error('Access record not found');
    }
  } catch (error) {
    if ((error as { code?: string })?.code === '23505') {
      throw new Error('Another access record already uses this access ID');
    }

    throw error;
  }
}

export async function deleteIntelligenceAccessRecord(input: {
  accessId: number;
  accountId: string;
}): Promise<void> {
  await ensureIntelligenceTables();
  const db = getIntelligenceDbPool();

  const result = await db.query(
    `
      DELETE FROM "intelligenceAccess"
      WHERE id = $1 AND account_id = $2
    `,
    [input.accessId, input.accountId]
  );

  if (result.rowCount === 0) {
    throw new Error('Access record not found');
  }
}

export async function rechargeIntelligenceAccessBalance(input: {
  accessId: number;
  amount: number;
  accountId: string;
}): Promise<void> {
  await ensureIntelligenceTables();
  const db = getIntelligenceDbPool();

  const result = await db.query<{ balance: number }>(
    `
      UPDATE "intelligenceAccess"
      SET balance = balance + $1
      WHERE id = $2 AND account_id = $3
      RETURNING balance
    `,
    [input.amount, input.accessId, input.accountId]
  );

  if (result.rowCount === 0) {
    throw new Error('Access record not found');
  }
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
  return {
    primaryModelId: parseOptionalInteger(formData.get('primary_model_id')),
    fallbackModelId: parseOptionalInteger(formData.get('fallback_model_id')),
    primaryAccessKey: parseOptionalInteger(formData.get('primary_access_key')),
    fallbackAccessKey: parseOptionalInteger(formData.get('fallback_access_key')),
    maxTokens: parseOptionalInteger(formData.get('max_tokens')),
    guider: parseOptionalString(formData.get('guider') ?? formData.get('def_prompt')),
  };
}

export function parseAccessIdFormData(formData: FormData) {
  return parseRequiredInteger(formData.get('access_id'), 'Access ID');
}

export function parseRechargeFormData(formData: FormData) {
  const amount = parseRequiredDecimal(formData.get('amount'), 'Recharge amount');

  if (amount <= 0) {
    throw new Error('Recharge amount must be greater than zero');
  }

  return {
    accessId: parseRequiredInteger(formData.get('access_id'), 'Access ID'),
    amount,
  };
}

export function parseLogContext(context: string | null): {
  displayContext: string;
  guider: string;
  query: string;
  usageTokens: number | null;
  status: string | null;
  estimatedCost: number | null;
  currency: string | null;
} {
  if (!context) {
    return {
      displayContext: '',
      guider: '',
      query: '',
      usageTokens: null,
      status: null,
      estimatedCost: null,
      currency: null,
    };
  }

  try {
    const parsed = JSON.parse(context);
    const usageTokens = Number(parsed?.usageTokens);
    const contextValue = parsed?.context ?? parsed?.requestContext;
    const displayContext = typeof contextValue === 'string'
      ? contextValue
      : contextValue !== undefined
        ? JSON.stringify(contextValue)
        : '';

    return {
      displayContext,
      guider:
        typeof parsed?.guider === 'string'
          ? parsed.guider
          : typeof parsed?.masterPrompt === 'string'
            ? parsed.masterPrompt
            : '',
      query: typeof parsed?.query === 'string' ? parsed.query : '',
      usageTokens: Number.isFinite(usageTokens) ? usageTokens : null,
      status: typeof parsed?.status === 'string' ? parsed.status : null,
      estimatedCost: Number.isFinite(Number(parsed?.estimatedCost)) ? Number(parsed?.estimatedCost) : null,
      currency: typeof parsed?.currency === 'string' && parsed.currency.trim() ? parsed.currency.trim().toUpperCase() : null,
    };
  } catch {
    return {
      displayContext: context,
      guider: '',
      query: '',
      usageTokens: null,
      status: null,
      estimatedCost: null,
      currency: null,
    };
  }
}
