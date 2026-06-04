import { after, NextRequest, NextResponse } from 'next/server';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';

import { ensureIntelligenceTables, getIntelligenceDbPool } from '@/core/ai/files/intelligence/db';
import { invokeModel } from '@/core/ai/files/intelligence/model-client';
import { getIntelligenceSettings, insertIntelligenceDevLog } from '@/core/ai/files/intelligence/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RESPONSE_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, userid, tokenKey, tokenkey, accessid, accessId, x-userid, x-tokenkey, x-accessid',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Cache-Control': 'no-store',
};

interface ParsedInput {
  promptId: string;
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
  id: number;
  prompt_id: string;
  account_id: string;
  token_hash: string;
  type: string;
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
  'message',
  'promptId',
  'accessKey',
]);

function successResponse(response: string, status = 200) {
  return NextResponse.json(
    {
      status: 'pass',
      response,
    },
    {
      status,
      headers: RESPONSE_HEADERS,
    }
  );
}

function errorResponse(message: string, status = 400) {
  return NextResponse.json(
    {
      status: 'fail',
      error: message,
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

  const promptId = String(parsedBody?.promptId || queryParameters.get('promptId') || '').trim();
  const accessKey = String(parsedBody?.accessKey || queryParameters.get('accessKey') || '').trim();
  const openFlowCandidates = parseOpenFlowCandidates(parsedBody?.model);
  const userQuery = String(
    parsedBody?.query ||
    parsedBody?.input ||
    parsedBody?.text ||
    parsedBody?.message ||
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
    promptId,
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
        ia.prompt_id,
        ia.account_id,
        ia.token_hash,
        ia.type,
        ia."primaryModel",
        ia."fallbackModel",
        ia."primaryModelConfig",
        ia."fallbackModelConfig",
        ia."primaryAccessKey",
        ia."fallbackAccessKey",
        primary_token."key" AS "primaryAccessTokenKey",
        fallback_token."key" AS "fallbackAccessTokenKey",
        ia."maxTokens",
        ia."defPrompt",
        ia.balance
      FROM "intelligenceAccess" ia
      LEFT JOIN "accessTokens" primary_token
        ON primary_token.id = ia."primaryAccessKey"
      LEFT JOIN "accessTokens" fallback_token
        ON fallback_token.id = ia."fallbackAccessKey"
      WHERE ia.account_id = $1 AND ia.prompt_id = $2
      ORDER BY ia.id DESC
      LIMIT 1
    `,
    [accountId, accessIdentifier]
  );

  return result.rows[0] || null;
}

async function findAccessRowByPromptId(promptId: string): Promise<IntelligenceAccessRow | null> {
  await ensureIntelligenceTables();
  const db = getIntelligenceDbPool();
  const result = await db.query<IntelligenceAccessRow>(
    `
      SELECT
        ia.id,
        ia.prompt_id,
        ia.account_id,
        ia.token_hash,
        ia.type,
        ia."primaryModel",
        ia."fallbackModel",
        ia."primaryModelConfig",
        ia."fallbackModelConfig",
        ia."primaryAccessKey",
        ia."fallbackAccessKey",
        primary_token."key" AS "primaryAccessTokenKey",
        fallback_token."key" AS "fallbackAccessTokenKey",
        ia."maxTokens",
        ia."defPrompt",
        ia.balance
      FROM "intelligenceAccess" ia
      LEFT JOIN "accessTokens" primary_token
        ON primary_token.id = ia."primaryAccessKey"
      LEFT JOIN "accessTokens" fallback_token
        ON fallback_token.id = ia."fallbackAccessKey"
      WHERE ia.prompt_id = $1
      ORDER BY ia.id DESC
      LIMIT 1
    `,
    [promptId]
  );

  return result.rows[0] || null;
}

async function shouldLogDevRequest(accountId: string | null): Promise<boolean> {
  if (!accountId) {
    return false;
  }

  const settings = await getIntelligenceSettings(accountId);
  return Boolean(settings.dev_mode);
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
  accessId: number;
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
}) {
  await ensureIntelligenceTables();
  const db = getIntelligenceDbPool();
  const balanceToDeduct = Math.max(input.cost || 0, 0);

  const updateResult = await db.query<{ balance: number }>(
    `
      UPDATE "intelligenceAccess"
      SET balance = GREATEST(balance - $1, 0)
      WHERE id = $2
      RETURNING balance
    `,
    [balanceToDeduct, input.accessId]
  );

  const remainingBalance = updateResult.rows[0]?.balance ?? Math.max(input.currentBalance - balanceToDeduct, 0);

  await db.query(
    `
      INSERT INTO "intelligenceLog" (access_id, query, response, context, modal, currency, cost, "inputTokens", "outputTokens", balance)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `,
    [
      input.accessId,
      input.query,
      input.responseText,
      buildStoredContext(input.context, {
        masterPrompt: input.masterPrompt,
        query: input.query,
        status: 'success',
        usageTokens: input.usageTokens,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        estimatedCost: input.cost,
        currency: input.currency,
      }),
      input.modal,
      input.currency,
      input.cost,
      input.inputTokens,
      input.outputTokens,
      remainingBalance,
    ]
  );
}

async function logFailedRequest(input: {
  accessId: number;
  query: string;
  masterPrompt: string;
  context: string;
  modal: string;
  errorMessage: string;
  balance: number;
  currency: string | null;
}) {
  await ensureIntelligenceTables();
  const db = getIntelligenceDbPool();
  await db.query(
    `
      INSERT INTO "intelligenceLog" (access_id, query, response, context, modal, currency, cost, "inputTokens", "outputTokens", balance)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `,
    [
      input.accessId,
      input.query,
      `ERROR: ${input.errorMessage}`,
      buildStoredContext(input.context, {
        masterPrompt: input.masterPrompt,
        query: input.query,
        status: 'error',
        usageTokens: 0,
        estimatedCost: null,
        currency: input.currency,
      }),
      input.modal,
      input.currency,
      null,
      0,
      0,
      input.balance,
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
      promptId: input.promptId || null,
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
    await logDevRequest({
      accountId: null,
      accessId: null,
      requestId,
      requestMethod: request.method,
      requestUrl: request.url,
      requestHeaders,
      requestBody: null,
      requestQuery: Object.fromEntries(request.nextUrl.searchParams.entries()),
      requestContext: null,
      responseStatus: 400,
      responseBody: {
        status: 'fail',
        error: error instanceof Error ? error.message : 'Invalid request body',
      },
      errorMessage: error instanceof Error ? error.message : 'Invalid request body',
      errorStack: error instanceof Error ? error.stack ?? null : null,
    });
    return errorResponse(error instanceof Error ? error.message : 'Invalid request body', 400);
  }

  accountIdForDevLog = null;
  accessIdForDevLog = input.promptId || null;
  devModeEnabled = await shouldLogDevRequest(accountIdForDevLog);
  traceStep('dev_mode_state', {
    requestId,
    accountId: accountIdForDevLog,
    devModeEnabled,
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
      responseStatus: null,
      responseBody: null,
      errorMessage: null,
      errorStack: null,
    });
  }

  const isOpenFlowRequest = input.openFlowCandidates.length > 0;
  const isPromptRequest = Boolean(input.promptId || input.accessKey);

  if (isOpenFlowRequest && isPromptRequest) {
    return errorResponse('Use either promptId/accessKey or model array, not both.', 400);
  }

  const access = isPromptRequest ? await findAccessRowByPromptId(input.promptId) : null;

  if (isPromptRequest && !input.promptId) {
    return errorResponse('promptId is required for prompt-based requests.', 400);
  }

  if (isPromptRequest && !input.accessKey) {
    return errorResponse('accessKey is required for prompt-based requests.', 400);
  }

  if (isPromptRequest && !access) {
    return errorResponse('No intelligence prompt was found for this promptId.', 404);
  }

  if (isPromptRequest && access && !tokenMatchesHash(input.accessKey, access.token_hash)) {
    return errorResponse('Invalid accessKey for this intelligence prompt.', 401);
  }

  if (isPromptRequest && access && Number(access.balance) <= 0) {
    return errorResponse('Insufficient balance for this intelligence prompt.', 402);
  }

  const legacyAccess = access as IntelligenceAccessRow | null;

  const primaryModel = normalizeModelName(legacyAccess?.primaryModel);
  const fallbackModel = normalizeModelName(legacyAccess?.fallbackModel);
  const primaryModelConfig = normalizeStoredModelConfig(legacyAccess?.primaryModelConfig);
  const fallbackModelConfig = normalizeStoredModelConfig(legacyAccess?.fallbackModelConfig);
  traceStep('model_context', {
    requestId,
    requestedModel: input.promptId || null,
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
        modelMatchesRequest(input.promptId, primaryModelConfig, primaryModel)
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
        modelMatchesRequest(input.promptId, fallbackModelConfig, fallbackModel)
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
        modelMatchesRequest(input.promptId, primaryModelConfig, primaryModel)
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
        modelMatchesRequest(input.promptId, fallbackModelConfig, fallbackModel)
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
    requestedModel: input.promptId || null,
    directModelCount: input.openFlowCandidates.length,
    candidateCount: modelCandidates.length,
    candidateIdentifiers: modelCandidates.map((candidate) => candidate?.identifier).filter(Boolean),
  });

  if (modelCandidates.length === 0) {
    return errorResponse(isOpenFlowRequest ? 'No valid open flow models were provided.' : 'No model candidates found for this promptId.', 400);
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
