import { after, NextRequest, NextResponse } from 'next/server';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';

import { ensureIntelligenceTables, getIntelligenceDbPool } from '@/core/ai/files/intelligence/db';
import { invokeModel } from '@/core/ai/files/intelligence/model-client';
import { insertIntelligenceDevLog } from '@/core/ai/files/intelligence/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RESPONSE_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, userid, tokenKey, tokenkey, accessid, accessId, x-userid, x-tokenkey, x-accessid',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Cache-Control': 'no-store',
};

interface ParsedInput {
  accessId: string;
  accessKey: string;
  openFlowCandidates: Array<{
    provider: string;
    model: string;
    apiKey: string;
  }>;
  parameters: Record<string, string>;
  context: string;
  userQuery: string;
  rawBody: Record<string, unknown> | null;
}

interface IntelligenceAccessRow {
  id: string;
  account_id: string;
  key_hash: string;
  status: string;
  type: string;
  available_to: unknown;
  details: unknown;
  primaryModel: string | null;
  fallbackModel: string | null;
  primaryModelConfig: unknown;
  fallbackModelConfig: unknown;
  primaryAccessKey: number | null;
  fallbackAccessKey: number | null;
  primaryAccessTokenKey: string | null;
  fallbackAccessTokenKey: string | null;
  maxTokens: number | null;
  defPrompt: string | null;
  balance: number;
}

interface BuiltPrompt {
  renderedPrompt: string;
  masterPrompt: string;
  context: string;
  query: string;
  hasMasterPrompt: boolean;
  hasContext: boolean;
  hasQuery: boolean;
}

interface StoredModelConfig {
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

function buildStoredContext(
  rawContext: string,
  metadata: Record<string, unknown> & {
    masterPrompt?: string;
    query?: string;
  }
): string {
  let requestContext: unknown = rawContext;

  if (rawContext.trim()) {
    try {
      requestContext = JSON.parse(rawContext);
    } catch {
      requestContext = rawContext;
    }
  }

  return JSON.stringify({
    context: requestContext,
    ...metadata,
  });
}

const RESERVED_QUERY_KEYS = new Set([
  'model',
  'parameter',
  'parameters',
  'context',
  'query',
  'input',
  'text',
  'accessId',
  'accessKey',
]);

function successResponse(response: string | unknown, status = 200) {
  const data = typeof response === 'string' ? { response } : response;
  
  return NextResponse.json(
    {
      success: true,
      ...data,
    },
    {
      status,
      headers: RESPONSE_HEADERS,
    }
  );
}

function errorResponse(errorCode: string, message?: string, status = 400) {
  return NextResponse.json(
    {
      success: false,
      error: message || errorCode,
    },
    {
      status,
      headers: RESPONSE_HEADERS,
    }
  );
}

function traceStep(step: string, details: Record<string, unknown> = {}) {
  void step;
  void details;
}

function safeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizeParameterValues(value: unknown): Record<string, string> {
  if (!value) {
    return {};
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return normalizeParameterValues(parsed);
    } catch {
      return { value };
    }
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value).reduce<Record<string, string>>((accumulator, [key, entryValue]) => {
    if (entryValue === undefined || entryValue === null) {
      return accumulator;
    }

    accumulator[key] = String(entryValue);
    return accumulator;
  }, {});
}

function extractQueryParameters(searchParams: URLSearchParams): Record<string, string> {
  const parameters: Record<string, string> = {};

  searchParams.forEach((value, key) => {
    if (!RESERVED_QUERY_KEYS.has(key)) {
      parameters[key] = value;
    }
  });

  return parameters;
}

function stringifyContext(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return '';
  }

  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value));
    } catch {
      return value;
    }
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function buildPrompt(
  masterPrompt: string | null,
  userQuery: string,
  parameters: Record<string, string>,
  context: string
): BuiltPrompt {
  const baseMasterPrompt = (masterPrompt || '').trim();
  const substitutedMasterPrompt = baseMasterPrompt.replace(
    /\{\{\s*([\w.-]+)\s*\}\}/g,
    (_, key: string) => parameters[key] ?? ''
  ).trim();

  const sections: string[] = [];

  if (userQuery.trim()) {
    sections.push(`Query:\n${userQuery.trim()}`);
  }

  if (substitutedMasterPrompt) {
    sections.push(`Master Prompt:\n${substitutedMasterPrompt}`);
  }

  if (context.trim()) {
    sections.push(`Context:\n${context.trim()}`);
  }

  if (Object.keys(parameters).length > 0 && substitutedMasterPrompt === baseMasterPrompt) {
    sections.push(`Parameters:\n${JSON.stringify(parameters, null, 2)}`);
  }

  return {
    renderedPrompt: sections.join('\n\n').trim(),
    masterPrompt: substitutedMasterPrompt,
    context: context.trim(),
    query: userQuery.trim(),
    hasMasterPrompt: Boolean(substitutedMasterPrompt),
    hasContext: Boolean(context.trim()),
    hasQuery: Boolean(userQuery.trim()),
  };
}

function normalizeModelName(value: string | null | undefined): string {
  return (value || '').trim();
}

function shouldLogAccessStatus(status: string | null | undefined): boolean {
  return (status || '').trim().toLowerCase() === 'dev';
}

function parseOpenFlowCandidates(value: unknown): Array<{ provider: string; model: string; apiKey: string }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .flatMap((entry) => {
      if (typeof entry !== 'string') {
        return [];
      }

      const normalized = entry.trim();
      if (!normalized) {
        return [];
      }

      const [modelSpec, apiKey] = normalized.split('@@@', 2);
      if (!modelSpec || !apiKey) {
        return [];
      }

      const trimmedModelSpec = modelSpec.trim();
      const trimmedKey = apiKey.trim();
      if (!trimmedModelSpec || !trimmedKey) {
        return [];
      }

      const slashIndex = trimmedModelSpec.indexOf('/');
      if (slashIndex <= 0 || slashIndex === trimmedModelSpec.length - 1) {
        return [];
      }

      return [{
        provider: trimmedModelSpec.slice(0, slashIndex).trim().toLowerCase(),
        model: trimmedModelSpec.slice(slashIndex + 1).trim(),
        apiKey: trimmedKey,
      }];
    })
    .filter((candidate): candidate is { provider: string; model: string; apiKey: string } => Boolean(candidate.provider && candidate.model && candidate.apiKey));
}

function normalizeStoredModelConfig(value: unknown): StoredModelConfig | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const title = typeof record.title === 'string' ? record.title.trim() : '';
  const provider = typeof record.provider === 'string' ? record.provider.trim().toLowerCase() : '';
  const model = typeof record.model === 'string' ? record.model.trim() : '';

  if (!title || !provider || !model) {
    return null;
  }

  return {
    id: Number.isFinite(Number(record.id)) ? Number(record.id) : 0,
    title,
    provider,
    model,
    description: typeof record.description === 'string' ? record.description : null,
    currency:
      typeof record.currency === 'string' && record.currency.trim()
        ? record.currency.trim().toUpperCase()
        : 'USD',
    inputRate:
      typeof record.inputRate === 'string' && record.inputRate.trim()
        ? record.inputRate.trim()
        : typeof record.rate === 'string' && record.rate.trim()
          ? record.rate.trim()
          : '0/1000',
    outputRate:
      typeof record.outputRate === 'string' && record.outputRate.trim()
        ? record.outputRate.trim()
        : typeof record.rate === 'string' && record.rate.trim()
          ? record.rate.trim()
          : '0/1000',
    inputCostPer1000Tokens: Number.isFinite(Number(record.inputCostPer1000Tokens))
      ? Number(record.inputCostPer1000Tokens)
      : Number.isFinite(Number(record.inputPrice))
        ? Number(record.inputPrice)
        : Number.isFinite(Number(record.costPer1000Tokens))
          ? Number(record.costPer1000Tokens)
          : 0,
    outputCostPer1000Tokens: Number.isFinite(Number(record.outputCostPer1000Tokens))
      ? Number(record.outputCostPer1000Tokens)
      : Number.isFinite(Number(record.outputPrice))
        ? Number(record.outputPrice)
        : Number.isFinite(Number(record.costPer1000Tokens))
          ? Number(record.costPer1000Tokens)
          : 0,
    price: record.price && typeof record.price === 'object' && !Array.isArray(record.price)
      ? (record.price as Record<string, unknown>)
      : {},
  };
}

function getModelIdentifier(config: StoredModelConfig | null, fallbackValue: string | null): string {
  if (config) {
    return `${config.provider}:${config.model}`;
  }

  return normalizeModelName(fallbackValue);
}

function modelMatchesRequest(requestedModel: string, config: StoredModelConfig | null, fallbackValue: string | null): boolean {
  const normalizedRequestedModel = normalizeModelName(requestedModel).toLowerCase();

  if (!normalizedRequestedModel) {
    return false;
  }

  const candidates = [
    getModelIdentifier(config, fallbackValue).toLowerCase(),
    config?.model?.toLowerCase() || '',
    fallbackValue?.toLowerCase() || '',
  ].filter(Boolean);

  return candidates.includes(normalizedRequestedModel);
}

function readPriceNumber(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = Number(source[key]);

    if (Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function estimateModelCost(
  modelConfig: {
    currency: string;
    inputCostPer1000Tokens: number;
    outputCostPer1000Tokens: number;
    price: Record<string, unknown>;
  },
  inputTokens: number,
  outputTokens: number,
  usageTokens: number
): { cost: number | null; currency: string | null } {
  if (modelConfig.inputCostPer1000Tokens > 0 || modelConfig.outputCostPer1000Tokens > 0) {
    return {
      cost: Number(
        (
          ((inputTokens / 1000) * modelConfig.inputCostPer1000Tokens) +
          ((outputTokens / 1000) * modelConfig.outputCostPer1000Tokens)
        ).toFixed(8)
      ),
      currency: modelConfig.currency || 'USD',
    };
  }

  const price = modelConfig.price;
  const inputPer1000 = readPriceNumber(price, ['inputCostPer1000Tokens', 'inputPer1000', 'input_per_1000']);
  const outputPer1000 = readPriceNumber(price, ['outputCostPer1000Tokens', 'outputPer1000', 'output_per_1000']);
  const per1000 = readPriceNumber(price, ['costPer1000Tokens', 'per1000', 'per_1000']);
  const inputPer1M = readPriceNumber(price, ['inputPer1M', 'input_per_1m', 'input']);
  const outputPer1M = readPriceNumber(price, ['outputPer1M', 'output_per_1m', 'output']);
  const flatPer1M = readPriceNumber(price, ['per1M', 'per_1m', 'totalPer1M']);
  const inputPerToken = readPriceNumber(price, ['inputPerToken', 'input_per_token']);
  const outputPerToken = readPriceNumber(price, ['outputPerToken', 'output_per_token']);
  const flatPerToken = readPriceNumber(price, ['perToken', 'per_token']);
  const currency =
    typeof price.currency === 'string' && price.currency.trim()
      ? price.currency.trim().toUpperCase()
      : modelConfig.currency || 'USD';

  if (inputPer1000 !== null || outputPer1000 !== null) {
    return {
      cost: Number(
        (
          ((inputTokens / 1000) * (inputPer1000 ?? per1000 ?? 0)) +
          ((outputTokens / 1000) * (outputPer1000 ?? per1000 ?? 0))
        ).toFixed(8)
      ),
      currency,
    };
  }

  if (per1000 !== null) {
    return {
      cost: Number(((usageTokens / 1000) * per1000).toFixed(8)),
      currency,
    };
  }

  if (inputPerToken !== null || outputPerToken !== null) {
    return {
      cost: Number(
        (
          (inputTokens * (inputPerToken ?? flatPerToken ?? 0)) +
          (outputTokens * (outputPerToken ?? flatPerToken ?? 0))
        ).toFixed(8)
      ),
      currency,
    };
  }

  if (inputPer1M !== null || outputPer1M !== null) {
    return {
      cost: Number(
        (
          ((inputTokens / 1_000_000) * (inputPer1M ?? flatPer1M ?? 0)) +
          ((outputTokens / 1_000_000) * (outputPer1M ?? flatPer1M ?? 0))
        ).toFixed(8)
      ),
      currency,
    };
  }

  if (flatPer1M !== null) {
    return {
      cost: Number(((usageTokens / 1_000_000) * flatPer1M).toFixed(8)),
      currency,
    };
  }

  if (flatPerToken !== null) {
    return {
      cost: Number((usageTokens * flatPerToken).toFixed(8)),
      currency,
    };
  }

  return {
    cost: null,
    currency: currency || null,
  };
}

function tokenMatchesHash(tokenKey: string, storedHash: string): boolean {
  const normalizedStoredHash = storedHash.trim();
  const sha256Hex = createHash('sha256').update(tokenKey).digest('hex');
  const sha256Base64 = createHash('sha256').update(tokenKey).digest('base64');
  const candidates = [
    tokenKey,
    sha256Hex,
    sha256Base64,
    `sha256:${sha256Hex}`,
    `sha256:${sha256Base64}`,
  ];

  return candidates.some((candidate) => safeEquals(candidate, normalizedStoredHash));
}

async function parseInput(request: NextRequest): Promise<ParsedInput> {
  let body: unknown = null;

  if (request.method === 'POST') {
    const contentType = request.headers.get('content-type') || '';

    if (!contentType.toLowerCase().includes('application/json')) {
      throw new Error('Invalid Content-Type. Send the request as application/json.');
    }

    const rawBody = await request.text();

    if (rawBody.trim()) {
      try {
        body = JSON.parse(rawBody);
      } catch {
        throw new Error('Invalid JSON body. Send raw JSON like {"context":"","query":"who are you?"}.');
      }
    }
  }

  const queryParameters = request.nextUrl.searchParams;

  if (request.method === 'POST' && body !== null && (typeof body !== 'object' || Array.isArray(body))) {
    throw new Error('Request body must be a raw JSON object');
  }

  const parsedBody: Record<string, unknown> =
    body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};

  const accessId = String(
    parsedBody?.accessId ||
    queryParameters.get('accessId') ||
    ''
  ).trim();
  const accessKey = String(parsedBody?.accessKey || queryParameters.get('accessKey') || '').trim();
  const openFlowCandidates = parseOpenFlowCandidates(parsedBody?.model);
  const userQuery = String(
    parsedBody?.query ||
    parsedBody?.input ||
    parsedBody?.text ||
    ''
  ).trim();

  const parameters = {
    ...extractQueryParameters(queryParameters),
    ...normalizeParameterValues(queryParameters.get('parameter')),
    ...normalizeParameterValues(queryParameters.get('parameters')),
    ...normalizeParameterValues(parsedBody?.parameter),
    ...normalizeParameterValues(parsedBody?.parameters),
  };

  const context = stringifyContext(
    parsedBody?.context ||
    (Object.keys(parameters).length > 0 ? parameters : '')
  );

  return {
    accessId,
    accessKey,
    openFlowCandidates,
    parameters,
    context,
    userQuery,
    rawBody: parsedBody,
  };
}

async function findAccessRow(accountId: string, accessIdentifier: string): Promise<IntelligenceAccessRow | null> {
  await ensureIntelligenceTables();
  const db = getIntelligenceDbPool();
  const result = await db.query<IntelligenceAccessRow>(
    `
      SELECT
        ia.id,
        ia.account_id,
        ia.key_hash,
        ia.status,
        ia.type,
        ia.available_to,
        ia.details,
        (ia.details->>'primaryModel')::TEXT AS "primaryModel",
        (ia.details->>'fallbackModel')::TEXT AS "fallbackModel",
        (ia.details->'primaryModelConfig')::JSONB AS "primaryModelConfig",
        (ia.details->'fallbackModelConfig')::JSONB AS "fallbackModelConfig",
        (ia.details->>'primaryAccessKey')::BIGINT AS "primaryAccessKey",
        (ia.details->>'fallbackAccessKey')::BIGINT AS "fallbackAccessKey",
        (ia.details->>'primaryAccessTokenKey')::TEXT AS "primaryAccessTokenKey",
        (ia.details->>'fallbackAccessTokenKey')::TEXT AS "fallbackAccessTokenKey",
        (ia.details->>'maxTokens')::INTEGER AS "maxTokens",
        (ia.details->>'defPrompt')::TEXT AS "defPrompt",
        ia.token_balance AS balance
      FROM "intelligence_access" ia
      WHERE ia.account_id = $1 AND ia.id = $2
      ORDER BY ia.id DESC
      LIMIT 1
    `,
    [accountId, accessIdentifier]
  );

  return result.rows[0] || null;
}

async function findAccessRowByAccessId(accessId: string): Promise<IntelligenceAccessRow | null> {
  await ensureIntelligenceTables();
  const db = getIntelligenceDbPool();
  const result = await db.query<IntelligenceAccessRow>(
    `
      SELECT
        ia.id,
        ia.account_id,
        ia.key_hash,
        ia.status,
        ia.type,
        ia.available_to,
        ia.details,
        (ia.details->>'primaryModel')::TEXT AS "primaryModel",
        (ia.details->>'fallbackModel')::TEXT AS "fallbackModel",
        (ia.details->'primaryModelConfig')::JSONB AS "primaryModelConfig",
        (ia.details->'fallbackModelConfig')::JSONB AS "fallbackModelConfig",
        (ia.details->>'primaryAccessKey')::BIGINT AS "primaryAccessKey",
        (ia.details->>'fallbackAccessKey')::BIGINT AS "fallbackAccessKey",
        (ia.details->>'primaryAccessTokenKey')::TEXT AS "primaryAccessTokenKey",
        (ia.details->>'fallbackAccessTokenKey')::TEXT AS "fallbackAccessTokenKey",
        (ia.details->>'maxTokens')::INTEGER AS "maxTokens",
        (ia.details->>'defPrompt')::TEXT AS "defPrompt",
        ia.token_balance AS balance
      FROM "intelligence_access" ia
      WHERE ia.id = $1
      ORDER BY ia.id DESC
      LIMIT 1
    `,
    [accessId]
  );

  return result.rows[0] || null;
}

async function logDevRequest(input: {
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
  try {
    await insertIntelligenceDevLog(input);
  } catch (error) {
    console.error('Failed to write intelligence dev log:', error);
  }
}

async function finalizeRequestLog(input: {
  accessId: string;
  query: string;
  masterPrompt: string;
  context: string;
  modal: string;
  responseText: string;
  usageTokens: number;
  inputTokens: number;
  outputTokens: number;
  cost: number | null;
  currency: string | null;
  currentBalance: number;
  devDetails?: Record<string, unknown> | null;
}) {
  await ensureIntelligenceTables();
  const db = getIntelligenceDbPool();
  const balanceToDeduct = Math.max(input.cost || 0, 0);

  const updateResult = await db.query<{ balance: number }>(
    `
      UPDATE "intelligence_access"
      SET token_balance = GREATEST(token_balance - $1, 0)
      WHERE id = $2
      RETURNING token_balance AS balance
    `,
    [balanceToDeduct, input.accessId]
  );

  const remainingBalance = updateResult.rows[0]?.balance ?? Math.max(input.currentBalance - balanceToDeduct, 0);

  const details = {
    query: input.query,
    response: input.responseText,
    context: buildStoredContext(input.context, {
      masterPrompt: input.masterPrompt,
      query: input.query,
      status: 'success',
      usageTokens: input.usageTokens,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      estimatedCost: input.cost,
      currency: input.currency,
    }),
    modal: input.modal,
    currency: input.currency,
    cost: input.cost,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    balance: remainingBalance,
  };

  await db.query(
    `
      INSERT INTO "intelligence_log" (access_id, details, balance_used, dev_details)
      VALUES ($1, $2, $3, $4)
    `,
    [
      input.accessId,
      JSON.stringify(details),
      balanceToDeduct,
      input.devDetails ? JSON.stringify(input.devDetails) : null,
    ]
  );
}

async function logFailedRequest(input: {
  accessId: string;
  query: string;
  masterPrompt: string;
  context: string;
  modal: string;
  errorMessage: string;
  balance: number;
  currency: string | null;
  devDetails?: Record<string, unknown> | null;
}) {
  await ensureIntelligenceTables();
  const db = getIntelligenceDbPool();
  
  const details = {
    query: input.query,
    response: `ERROR: ${input.errorMessage}`,
    context: buildStoredContext(input.context, {
      masterPrompt: input.masterPrompt,
      query: input.query,
      status: 'error',
      usageTokens: 0,
      estimatedCost: null,
      currency: input.currency,
    }),
    modal: input.modal,
    currency: input.currency,
    cost: null,
    inputTokens: 0,
    outputTokens: 0,
    balance: input.balance,
  };

  await db.query(
    `
      INSERT INTO "intelligence_log" (access_id, details, balance_used, dev_details)
      VALUES ($1, $2, $3, $4)
    `,
    [
      input.accessId,
      JSON.stringify(details),
      0,
      input.devDetails ? JSON.stringify(input.devDetails) : null,
    ]
  );
}

async function handleRequest(request: NextRequest) {
  const requestId = randomUUID();
  traceStep('request_received', {
    requestId,
    method: request.method,
    url: request.url,
  });
  const requestHeaders = Object.fromEntries(request.headers.entries());
  let parsedBodyForDevLog: Record<string, unknown> | null = null;
  let parsedQueryForDevLog: Record<string, string> = {};
  let parsedContextForDevLog: Record<string, unknown> | null = null;
  let accountIdForDevLog: string | null = null;
  let accessIdForDevLog: string | null = null;
  let devModeEnabled = false;

  let input: ParsedInput;

  try {
    input = await parseInput(request);
    traceStep('request_parsed', {
      requestId,
      accessId: input.accessId || null,
      accessKeyPresent: Boolean(input.accessKey),
      hasOpenFlowModels: input.openFlowCandidates.length > 0,
      parameterKeys: Object.keys(input.parameters),
      hasContext: Boolean(input.context.trim()),
      hasQuery: Boolean(input.userQuery.trim()),
    });
    parsedBodyForDevLog = input.rawBody;
    parsedQueryForDevLog = Object.fromEntries(request.nextUrl.searchParams.entries());
    parsedContextForDevLog =
      parsedBodyForDevLog && typeof parsedBodyForDevLog.context === 'object' && parsedBodyForDevLog.context !== null && !Array.isArray(parsedBodyForDevLog.context)
        ? (parsedBodyForDevLog.context as Record<string, unknown>)
        : null;
  } catch (error) {
    traceStep('request_parse_failed', {
      requestId,
      error: error instanceof Error ? error.message : 'Invalid request body',
    });
    return errorResponse('invalid_request', error instanceof Error ? error.message : 'Invalid request body', 400);
  }

  const isOpenFlowRequest = input.openFlowCandidates.length > 0;
  const isPromptRequest = Boolean(input.accessId || input.accessKey);

  if (isOpenFlowRequest && isPromptRequest) {
    return errorResponse('invalid_request', 'Use either accessId/accessKey or model array, not both.', 400);
  }

  const access = isPromptRequest ? await findAccessRowByAccessId(input.accessId) : null;

  if (isPromptRequest && !input.accessId) {
    return errorResponse('access_id_required', 'accessId is required for prompt-based requests.', 400);
  }

  if (isPromptRequest && !input.accessKey) {
    return errorResponse('access_key_required', 'accessKey is required for prompt-based requests.', 400);
  }

  if (isPromptRequest && !access) {
    return errorResponse('access_id_invalid', 'No intelligence access was found for this accessId.', 404);
  }

  accountIdForDevLog = access?.account_id || null;
  accessIdForDevLog = access?.id || input.accessId || null;
  devModeEnabled = shouldLogAccessStatus(access?.status);
  traceStep('access_status_state', {
    requestId,
    accountId: accountIdForDevLog,
    accessId: accessIdForDevLog,
    status: access?.status || null,
    devModeEnabled,
  });

  if (access?.status?.trim().toLowerCase() === 'hold') {
    return errorResponse('access_invalid', 'This access is on hold.', 403);
  }

  if (access?.status?.trim().toLowerCase() === 'unpublished') {
    return errorResponse('access_invalid', 'This access is unpublished.', 403);
  }

  if (devModeEnabled) {
    await logDevRequest({
      accountId: accountIdForDevLog,
      accessId: accessIdForDevLog,
      requestId,
      requestMethod: request.method,
      requestUrl: request.url,
      requestHeaders,
      requestBody: parsedBodyForDevLog,
      requestQuery: parsedQueryForDevLog,
      requestContext: parsedContextForDevLog,
      responseStatus: null,
      responseBody: null,
      errorMessage: null,
      errorStack: null,
    });
  }

  if (isPromptRequest && access && !tokenMatchesHash(input.accessKey, access.key_hash)) {
    return errorResponse('access_key_invalid', 'Invalid accessKey for this intelligence prompt.', 401);
  }

  if (isPromptRequest && access && Number(access.balance) <= 0) {
    return errorResponse('negative_balance', 'Insufficient balance for this intelligence prompt.', 402);
  }

  const legacyAccess = access as IntelligenceAccessRow | null;

  const primaryModel = normalizeModelName(legacyAccess?.primaryModel);
  const fallbackModel = normalizeModelName(legacyAccess?.fallbackModel);
  const primaryModelConfig = normalizeStoredModelConfig(legacyAccess?.primaryModelConfig);
  const fallbackModelConfig = normalizeStoredModelConfig(legacyAccess?.fallbackModelConfig);
  traceStep('model_context', {
    requestId,
    requestedModel: input.accessId || null,
    primaryModel,
    fallbackModel,
    directModelCount: input.openFlowCandidates.length,
    primaryProvider: primaryModelConfig?.provider || null,
    fallbackProvider: fallbackModelConfig?.provider || null,
  });

  const promptPayload = buildPrompt(legacyAccess?.defPrompt || null, input.userQuery, input.parameters, input.context);

  if (!promptPayload.renderedPrompt) {
    traceStep('validation_failed', { requestId, reason: 'empty_rendered_prompt' });
    if (request.method !== 'POST') {
      return errorResponse(
        'Invalid request method for this payload. Send a POST request with a raw JSON body containing query and/or context.',
        400
      );
    }

    const message =
      'Invalid request parameters. No masterPrompt is saved for this access, and the JSON body did not include query or context.';
    if (devModeEnabled) {
      await logDevRequest({
        accountId: accountIdForDevLog,
        accessId: accessIdForDevLog,
        requestId,
        requestMethod: request.method,
        requestUrl: request.url,
        requestHeaders,
        requestBody: parsedBodyForDevLog,
        requestQuery: parsedQueryForDevLog,
        requestContext: parsedContextForDevLog,
        responseStatus: 400,
        responseBody: { status: 'fail', error: message },
        errorMessage: message,
        errorStack: null,
      });
    }
    return errorResponse(message, 400);
  }

  const modelCandidates = legacyAccess?.type === 'open'
    ? input.openFlowCandidates.map((candidate) => ({
        provider: candidate.provider,
        model: candidate.model,
        identifier: `${candidate.provider}:${candidate.model}`,
        modelConfig: {
          currency: 'USD',
          inputCostPer1000Tokens: 0,
          outputCostPer1000Tokens: 0,
          price: {},
        },
        apiKey: candidate.apiKey,
        source: 'direct' as const,
      }))
    : legacyAccess?.type === 'model_key_def'
    ? [
        modelMatchesRequest(input.accessId, primaryModelConfig, primaryModel)
          ? {
              provider: primaryModelConfig?.provider || null,
              model: primaryModelConfig?.model || primaryModel,
              identifier: getModelIdentifier(primaryModelConfig, primaryModel),
              modelConfig: {
                currency: primaryModelConfig?.currency || 'USD',
                inputCostPer1000Tokens: primaryModelConfig?.inputCostPer1000Tokens || 0,
                outputCostPer1000Tokens: primaryModelConfig?.outputCostPer1000Tokens || 0,
                price: primaryModelConfig?.price || {},
              },
              apiKey: legacyAccess?.primaryAccessTokenKey || '',
              source: 'primary' as const,
            }
          : null,
        modelMatchesRequest(input.accessId, fallbackModelConfig, fallbackModel)
          ? {
              provider: fallbackModelConfig?.provider || null,
              model: fallbackModelConfig?.model || fallbackModel,
              identifier: getModelIdentifier(fallbackModelConfig, fallbackModel),
              modelConfig: {
                currency: fallbackModelConfig?.currency || 'USD',
                inputCostPer1000Tokens: fallbackModelConfig?.inputCostPer1000Tokens || 0,
                outputCostPer1000Tokens: fallbackModelConfig?.outputCostPer1000Tokens || 0,
                price: fallbackModelConfig?.price || {},
              },
              apiKey: legacyAccess?.fallbackAccessTokenKey || '',
              source: 'fallback' as const,
            }
          : null,
      ].filter(Boolean)
    : isPromptRequest
    ? [
        modelMatchesRequest(input.accessId, primaryModelConfig, primaryModel)
          ? {
              provider: primaryModelConfig?.provider || null,
              model: primaryModelConfig?.model || primaryModel,
              identifier: getModelIdentifier(primaryModelConfig, primaryModel),
              modelConfig: {
                currency: primaryModelConfig?.currency || 'USD',
                inputCostPer1000Tokens: primaryModelConfig?.inputCostPer1000Tokens || 0,
                outputCostPer1000Tokens: primaryModelConfig?.outputCostPer1000Tokens || 0,
                price: primaryModelConfig?.price || {},
              },
              apiKey: legacyAccess?.primaryAccessTokenKey || '',
              source: 'primary' as const,
            }
          : null,
        modelMatchesRequest(input.accessId, fallbackModelConfig, fallbackModel)
          ? {
              provider: fallbackModelConfig?.provider || null,
              model: fallbackModelConfig?.model || fallbackModel,
              identifier: getModelIdentifier(fallbackModelConfig, fallbackModel),
              modelConfig: {
                currency: fallbackModelConfig?.currency || 'USD',
                inputCostPer1000Tokens: fallbackModelConfig?.inputCostPer1000Tokens || 0,
                outputCostPer1000Tokens: fallbackModelConfig?.outputCostPer1000Tokens || 0,
                price: fallbackModelConfig?.price || {},
              },
              apiKey: legacyAccess?.fallbackAccessTokenKey || '',
              source: 'fallback' as const,
            }
          : null,
      ].filter(Boolean)
    : [];
  traceStep('model_candidates_built', {
    requestId,
    requestedModel: input.accessId || null,
    directModelCount: input.openFlowCandidates.length,
    candidateCount: modelCandidates.length,
    candidateIdentifiers: modelCandidates.map((candidate) => candidate?.identifier).filter(Boolean),
  });

  if (modelCandidates.length === 0) {
    return errorResponse(isOpenFlowRequest ? 'No valid open flow models were provided.' : 'No model candidates found for this accessId.', 400);
  }

  const usableCandidates = modelCandidates.filter(
    (candidate): candidate is {
      provider: string | null;
      model: string;
      identifier: string;
      modelConfig: {
        currency: string;
        inputCostPer1000Tokens: number;
        outputCostPer1000Tokens: number;
        price: Record<string, unknown>;
      };
      apiKey: string;
      source: 'primary' | 'fallback' | 'direct';
    } =>
      Boolean(candidate?.model && candidate?.apiKey)
  );

  if (usableCandidates.length === 0) {
    traceStep('validation_failed', { requestId, reason: 'no_usable_candidates' });
    if (devModeEnabled) {
      await logDevRequest({
        accountId: accountIdForDevLog,
        accessId: accessIdForDevLog,
        requestId,
        requestMethod: request.method,
        requestUrl: request.url,
        requestHeaders,
        requestBody: parsedBodyForDevLog,
        requestQuery: parsedQueryForDevLog,
        requestContext: parsedContextForDevLog,
        responseStatus: 400,
        responseBody: { status: 'fail', error: 'No access token configured for the available models' },
        errorMessage: 'No access token configured for the available models',
        errorStack: null,
      });
    }
    return errorResponse('No access token configured for the available models', 400);
  }

  let lastErrorMessage = 'Failed to generate response';

  for (const candidate of usableCandidates) {
    try {
      traceStep('provider_invoke_start', {
        requestId,
        source: candidate.source,
        provider: candidate.provider,
        model: candidate.model,
        identifier: candidate.identifier,
      });
      const modelResult = await invokeModel({
        provider: candidate.provider,
        model: candidate.model,
        prompt: promptPayload.renderedPrompt,
        maxTokens: isPromptRequest ? legacyAccess?.maxTokens ?? null : null,
        apiKey: candidate.apiKey,
      });
      traceStep('provider_invoke_success', {
        requestId,
        source: candidate.source,
        provider: modelResult.provider,
        model: modelResult.model,
        inputTokens: modelResult.inputTokens,
        outputTokens: modelResult.outputTokens,
        usageTokens: modelResult.usageTokens,
      });

      const estimatedCost = estimateModelCost(
        candidate.modelConfig,
        modelResult.inputTokens,
        modelResult.outputTokens,
        modelResult.usageTokens
      );

      after(async () => {
        try {
          const devDetails = devModeEnabled ? {
            accountId: accountIdForDevLog,
            accessId: accessIdForDevLog,
            requestId,
            requestMethod: request.method,
            requestUrl: request.url,
            requestHeaders,
            requestBody: parsedBodyForDevLog,
            requestQuery: parsedQueryForDevLog,
            requestContext: parsedContextForDevLog,
            responseStatus: 200,
            responseBody: { status: 'pass', response: modelResult.responseText },
            errorMessage: null,
            errorStack: null,
          } : null;

          if (devModeEnabled) {
            await logDevRequest({
              accountId: accountIdForDevLog,
              accessId: accessIdForDevLog,
              requestId,
              requestMethod: request.method,
              requestUrl: request.url,
              requestHeaders,
              requestBody: parsedBodyForDevLog,
              requestQuery: parsedQueryForDevLog,
              requestContext: parsedContextForDevLog,
              responseStatus: 200,
              responseBody: { status: 'pass', response: modelResult.responseText },
              errorMessage: null,
              errorStack: null,
            });
          }
          if (isPromptRequest && legacyAccess) {
            await finalizeRequestLog({
              accessId: legacyAccess.id,
              query: promptPayload.query,
              masterPrompt: promptPayload.masterPrompt,
              context: promptPayload.context,
              modal: candidate.identifier,
              responseText: modelResult.responseText,
              usageTokens: modelResult.usageTokens,
              inputTokens: modelResult.inputTokens,
              outputTokens: modelResult.outputTokens,
              cost: estimatedCost.cost,
              currency: estimatedCost.currency,
              currentBalance: Number(legacyAccess.balance),
              devDetails,
            });
          }
        } catch (error) {
          void error;
        }
      });

      return successResponse(modelResult.responseText);
    } catch (error) {
      lastErrorMessage = error instanceof Error ? error.message : 'Failed to generate response';
      traceStep('provider_invoke_failed', {
        requestId,
        error: lastErrorMessage,
      });
    }
  }

  after(async () => {
    try {
      traceStep('final_failure_response', {
        requestId,
        error: lastErrorMessage,
      });
      if (devModeEnabled) {
        await logDevRequest({
          accountId: accountIdForDevLog,
          accessId: accessIdForDevLog,
          requestId,
          requestMethod: request.method,
          requestUrl: request.url,
          requestHeaders,
          requestBody: parsedBodyForDevLog,
          requestQuery: parsedQueryForDevLog,
          requestContext: parsedContextForDevLog,
          responseStatus: 500,
          responseBody: { status: 'fail', error: lastErrorMessage },
          errorMessage: lastErrorMessage,
          errorStack: null,
        });
      }
      
      const devDetails = devModeEnabled ? {
        accountId: accountIdForDevLog,
        accessId: accessIdForDevLog,
        requestId,
        requestMethod: request.method,
        requestUrl: request.url,
        requestHeaders,
        requestBody: parsedBodyForDevLog,
        requestQuery: parsedQueryForDevLog,
        requestContext: parsedContextForDevLog,
        responseStatus: 500,
        responseBody: { status: 'fail', error: lastErrorMessage },
        errorMessage: lastErrorMessage,
        errorStack: null,
      } : null;

      if (isPromptRequest && legacyAccess) {
        await logFailedRequest({
          accessId: legacyAccess.id,
          query: promptPayload.query,
          masterPrompt: promptPayload.masterPrompt,
          context: promptPayload.context,
          modal: usableCandidates.map((candidate) => candidate.identifier).join(' -> '),
          errorMessage: lastErrorMessage,
          balance: Number(legacyAccess.balance),
          currency: usableCandidates[0]?.modelConfig.currency || null,
          devDetails,
        });
      }
    } catch (logError) {
      void logError;
    }
  });

  return errorResponse(lastErrorMessage, 500);
}

export async function GET(request: NextRequest) {
  return handleRequest(request);
}

export async function POST(request: NextRequest) {
  return handleRequest(request);
}

export async function OPTIONS() {
  await ensureIntelligenceTables();

  return new NextResponse(null, {
    status: 204,
    headers: RESPONSE_HEADERS,
  });
}
