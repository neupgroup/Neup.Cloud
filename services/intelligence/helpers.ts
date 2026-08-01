import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';

type IntelligenceAccessType = 'open' | 'hybrid' | 'closed';
type IntelligenceAccessStatus = 'unpublished' | 'dev' | 'prod' | 'hold';

/*
::neup.documentation::intelligence-helpers
::private

Plain synchronous helpers for intelligence identifiers, token hashing, encryption, display masking, details parsing, and form data normalization.

This module intentionally has no `use server` directive because these utilities are consumed by Server Actions and Server Components but are not Server Actions themselves.

::private end
::end
*/

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

function parseIntegerFormValue(formData: FormData, name: string): number | null {
  const value = String(formData.get(name) || '').trim();
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

export function generateAccessIdentifier(): string {
  return `acc_${randomUUID().replace(/-/g, '').slice(0, 24)}`;
}

export function generateAccessToken(): string {
  return `neup_${randomBytes(24).toString('base64url')}`;
}

export function hashAccessToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function encryptionKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

export function encryptValue(value: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv, tag, encrypted].map((part) => part.toString('base64url')).join('.');
}

export function decryptValue(value: string, secret: string): string {
  const [ivRaw, tagRaw, encryptedRaw] = value.split('.');
  if (!ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error('Invalid encrypted value.');
  }

  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(secret), Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function maskSecret(value: string): string {
  const mask = '\u2022\u2022\u2022\u2022';
  if (value.length <= 8) return mask;
  return `${value.slice(0, 4)}${mask}${value.slice(-4)}`;
}

export function buildModelString(provider: string, model: string, apiKey: string | null, tokenId: number | null): string {
  return `${provider}/${model}/${apiKey || '0'}/${tokenId ?? 0}`;
}

export function parseModelString(value: string) {
  const [provider, model, apiKey, tokenId] = value.split('/');
  return {
    provider: provider || null,
    model: model || null,
    apiKey: apiKey && apiKey !== '0' ? apiKey : null,
    tokenId: toNullableNumber(tokenId),
  };
}

export function buildDetailsObject(defPrompt: string | null, modelStrings: string[]) {
  const [primary, fallback] = modelStrings.map(parseModelString);

  return {
    defPrompt,
    primaryModel: primary?.provider && primary.model ? `${primary.provider}:${primary.model}` : null,
    fallbackModel: fallback?.provider && fallback.model ? `${fallback.provider}:${fallback.model}` : null,
    primaryModelConfig: primary?.provider && primary.model ? { provider: primary.provider, model: primary.model } : null,
    fallbackModelConfig: fallback?.provider && fallback.model ? { provider: fallback.provider, model: fallback.model } : null,
    primaryAccessKey: primary?.tokenId ?? null,
    fallbackAccessKey: fallback?.tokenId ?? null,
  };
}

export function parseDetailsObject(value: unknown): Record<string, unknown> {
  return asRecord(normalizeDetails(value));
}

export function parseDetailsArray(value: unknown): string[] {
  const details = normalizeDetails(value);
  if (Array.isArray(details)) return details.map((item) => String(item));
  const record = asRecord(details);
  const result: string[] = [];
  if (typeof record.defPrompt === 'string') result.push(record.defPrompt);
  if (typeof record.primaryModel === 'string') result.push(record.primaryModel);
  if (typeof record.fallbackModel === 'string') result.push(record.fallbackModel);
  return result;
}

export function isAccessPublished(details: unknown): boolean {
  return parseDetailsArray(details).some((item) => item.includes('/') && !item.includes('/0/'));
}

export function parseModelFormData(formData: FormData) {
  const inputCostPer1000Tokens = Number(formData.get('input_cost_per_1000_tokens') || formData.get('inputRate') || 0);
  const outputCostPer1000Tokens = Number(formData.get('output_cost_per_1000_tokens') || formData.get('outputRate') || 0);

  return {
    title: String(formData.get('title') || '').trim(),
    provider: String(formData.get('provider') || '').trim().toLowerCase(),
    model: String(formData.get('model') || '').trim(),
    description: String(formData.get('description') || '').trim() || null,
    currency: String(formData.get('currency') || 'USD').trim().toUpperCase(),
    inputRate: String(formData.get('inputRate') || inputCostPer1000Tokens),
    outputRate: String(formData.get('outputRate') || outputCostPer1000Tokens),
    inputCostPer1000Tokens: Number.isFinite(inputCostPer1000Tokens) ? inputCostPer1000Tokens : 0,
    outputCostPer1000Tokens: Number.isFinite(outputCostPer1000Tokens) ? outputCostPer1000Tokens : 0,
  };
}

export function parseAccessFormData(formData: FormData) {
  return {
    accessType: (String(formData.get('access_type') || 'open') as IntelligenceAccessType),
    status: (String(formData.get('status') || 'prod') as IntelligenceAccessStatus),
    maxTokens: parseIntegerFormValue(formData, 'max_tokens'),
    prompt: String(formData.get('def_prompt') || formData.get('prompt') || '').trim() || null,
    primaryModelId: parseIntegerFormValue(formData, 'primary_model_id'),
    fallbackModelId: parseIntegerFormValue(formData, 'fallback_model_id'),
    primaryAccessKey: parseIntegerFormValue(formData, 'primary_access_key'),
    fallbackAccessKey: parseIntegerFormValue(formData, 'fallback_access_key'),
  };
}

export function parseAccessIdFormData(formData: FormData): string {
  return String(formData.get('access_id') || formData.get('id') || '').trim();
}

export function parseModelIdFormData(formData: FormData): number {
  return Number(formData.get('model_id') || formData.get('id') || 0);
}

export function parseRechargeFormData(formData: FormData) {
  return {
    accessId: parseAccessIdFormData(formData),
    amount: Number(formData.get('amount') || 0),
  };
}
