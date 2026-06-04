const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
const currencyNames = new Intl.DisplayNames(['en'], { type: 'currency' });

const currencyRegions: Record<string, string> = {
  AED: 'AE',
  AUD: 'AU',
  BDT: 'BD',
  BRL: 'BR',
  CAD: 'CA',
  CHF: 'CH',
  CNY: 'CN',
  DKK: 'DK',
  EUR: 'EU',
  GBP: 'GB',
  HKD: 'HK',
  IDR: 'ID',
  INR: 'IN',
  JPY: 'JP',
  KRW: 'KR',
  KWD: 'KW',
  MXN: 'MX',
  MYR: 'MY',
  NOK: 'NO',
  NPR: 'NP',
  NZD: 'NZ',
  PHP: 'PH',
  PKR: 'PK',
  QAR: 'QA',
  SAR: 'SA',
  SEK: 'SE',
  SGD: 'SG',
  THB: 'TH',
  TRY: 'TR',
  USD: 'US',
  ZAR: 'ZA',
};

const intlWithSupportedValues = Intl as typeof Intl & {
  supportedValuesOf?: (key: string) => string[];
};

const supportedCurrencies = new Set(
  typeof intlWithSupportedValues.supportedValuesOf === 'function'
    ? intlWithSupportedValues.supportedValuesOf('currency').map((value) => value.toUpperCase())
    : Object.keys(currencyRegions)
);

export const providerOptions = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google' },
  { value: 'nvidia', label: 'NVIDIA' },
] as const;

const commonCurrencyCodes = [
  'USD',
  'EUR',
  'GBP',
  'INR',
  'NPR',
  'AUD',
  'CAD',
  'SGD',
  'AED',
  'JPY',
  'CHF',
  'HKD',
] as const;

export interface CurrencyDetails {
  code: string;
  name: string;
  regionCode: string | null;
  regionName: string | null;
  caption: string;
}

export interface ProviderDetails {
  value: string;
  label: string;
}

export interface RateDetails {
  rate: string;
  costPer1000Tokens: number;
  costPerToken: number;
}

export function normalizeProviderInput(value: string): string {
  return value.trim().toLowerCase();
}

export function resolveProviderDetails(value: string): ProviderDetails | null {
  const normalized = normalizeProviderInput(value);
  return providerOptions.find((option) => option.value === normalized) || null;
}

export function getProviderSuggestions(value: string): ProviderDetails[] {
  const normalized = normalizeProviderInput(value);

  if (!normalized) {
    return [...providerOptions];
  }

  return providerOptions.filter((option) =>
    option.value.includes(normalized) || option.label.toLowerCase().includes(normalized)
  );
}

export function normalizeCurrencyInput(value: string): string {
  return value.replace(/[^a-z]/gi, '').toUpperCase();
}

export function resolveCurrencyDetails(value: string): CurrencyDetails | null {
  const code = normalizeCurrencyInput(value);

  if (code.length !== 3 || !supportedCurrencies.has(code)) {
    return null;
  }

  const name = currencyNames.of(code);

  if (!name) {
    return null;
  }

  const regionCode = currencyRegions[code] || null;
  const regionName = regionCode ? regionNames.of(regionCode) || null : null;

  return {
    code,
    name,
    regionCode,
    regionName,
    caption: regionName ? `${regionName} · ${name}` : name,
  };
}

export function getCurrencySuggestions(value: string): CurrencyDetails[] {
  const normalized = normalizeCurrencyInput(value);

  return commonCurrencyCodes
    .map((code) => resolveCurrencyDetails(code))
    .filter((details): details is CurrencyDetails => Boolean(details))
    .filter((details) =>
      !normalized ||
      details.code.includes(normalized) ||
      details.name.toLowerCase().includes(normalized.toLowerCase()) ||
      (details.regionName || '').toLowerCase().includes(normalized.toLowerCase())
    );
}

export function parseRateDetails(value: string): RateDetails | null {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  const fractionMatch = normalized.match(/^\s*([0-9]*\.?[0-9]+)\s*\/\s*([0-9]*\.?[0-9]+)\s*$/);

  if (fractionMatch) {
    const numerator = Number(fractionMatch[1]);
    const denominator = Number(fractionMatch[2]);

    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
      return null;
    }

    const costPerToken = numerator / denominator;

    return {
      rate: `${numerator}/${denominator}`,
      costPerToken,
      costPer1000Tokens: Number((costPerToken * 1000).toFixed(12)),
    };
  }

  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return {
    rate: normalized,
    costPerToken: parsed / 1000,
    costPer1000Tokens: parsed,
  };
}
