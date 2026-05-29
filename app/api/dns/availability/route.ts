import { NextRequest, NextResponse } from 'next/server';

const DOMAIN_REGEX = /^(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/i;
const RDAP_BOOTSTRAP_URL = 'https://data.iana.org/rdap/dns.json';

type RdapResponse = {
  ldhName?: string;
  handle?: string;
  status?: string[];
  entities?: Array<{ roles?: string[]; vcardArray?: unknown[] }>;
  events?: Array<{ eventAction?: string; eventDate?: string }>;
  nameservers?: Array<{ ldhName?: string }>;
};

type RdapBootstrap = {
  services?: Array<[string[], string[]]>;
};

function normalizeDomain(value: string): string {
  return value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
}

function readVCardValue(vcardArray: unknown[] | undefined, key: string): string | null {
  if (!Array.isArray(vcardArray) || vcardArray.length < 2 || !Array.isArray(vcardArray[1])) {
    return null;
  }

  const entries = vcardArray[1] as unknown[];
  const row = entries.find((entry) => Array.isArray(entry) && entry[0] === key) as unknown[] | undefined;
  if (!row || row.length < 4) {
    return null;
  }

  const value = row[3];
  return typeof value === 'string' ? value : null;
}

function extractWhoisSummary(data: RdapResponse) {
  const registrarEntity = data.entities?.find((entity) => entity.roles?.includes('registrar'));

  const createdAt = data.events?.find((event) => event.eventAction === 'registration')?.eventDate ?? null;
  const updatedAt = data.events?.find((event) => event.eventAction === 'last changed')?.eventDate ?? null;
  const expiresAt =
    data.events?.find((event) => event.eventAction === 'expiration')?.eventDate ??
    data.events?.find((event) => event.eventAction === 'expiry')?.eventDate ??
    null;

  return {
    domainName: data.ldhName ?? null,
    whoisHandle: data.handle ?? null,
    registrar: readVCardValue(registrarEntity?.vcardArray, 'fn'),
    statuses: data.status ?? [],
    createdAt,
    updatedAt,
    expiresAt,
    nameservers: (data.nameservers ?? []).map((item) => item.ldhName).filter((value): value is string => Boolean(value)),
  };
}

function getTld(domain: string): string {
  const parts = domain.split('.');
  return parts[parts.length - 1] ?? '';
}

async function fetchRdapFromBootstrap(domain: string): Promise<RdapResponse | null> {
  const tld = getTld(domain);
  if (!tld) return null;

  const bootstrapResponse = await fetch(RDAP_BOOTSTRAP_URL, {
    method: 'GET',
    cache: 'no-store',
    headers: { accept: 'application/json' },
  });

  if (!bootstrapResponse.ok) return null;

  const bootstrap = (await bootstrapResponse.json()) as RdapBootstrap;
  const services = bootstrap.services ?? [];

  const service = services.find(([tlds]) => tlds.includes(tld));
  if (!service) return null;

  const baseUrls = service[1] ?? [];
  for (const baseUrl of baseUrls) {
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const candidateUrl = `${normalizedBase}domain/${encodeURIComponent(domain)}`;

    const rdapResponse = await fetch(candidateUrl, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        accept: 'application/rdap+json, application/json;q=0.9',
      },
    });

    if (!rdapResponse.ok) continue;
    return (await rdapResponse.json()) as RdapResponse;
  }

  return null;
}

async function fetchRdapWithFallback(domain: string): Promise<RdapResponse | null> {
  const bootstrapResult = await fetchRdapFromBootstrap(domain);
  if (bootstrapResult) return bootstrapResult;

  const fallbackProviders = [
    `https://rdap.org/domain/${encodeURIComponent(domain)}`,
    `https://rdap.verisign.com/com/v1/domain/${encodeURIComponent(domain)}`,
    `https://rdap.verisign.com/net/v1/domain/${encodeURIComponent(domain)}`,
  ];

  for (const url of fallbackProviders) {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        accept: 'application/rdap+json, application/json;q=0.9',
      },
    });

    if (!response.ok) continue;
    return (await response.json()) as RdapResponse;
  }

  return null;
}

export async function GET(request: NextRequest) {
  const domainParam = request.nextUrl.searchParams.get('domain');
  if (!domainParam) {
    return NextResponse.json({ error: 'Domain parameter is required' }, { status: 400 });
  }

  const domain = normalizeDomain(domainParam);
  if (!DOMAIN_REGEX.test(domain)) {
    return NextResponse.json(
      {
        domain,
        whoisExists: false,
        reason: 'Invalid domain format',
      },
      { status: 400 }
    );
  }

  const nameComUrl = `https://www.name.com/domain/search/${encodeURIComponent(domain)}`;

  try {
    const payload = await fetchRdapWithFallback(domain);
    if (!payload) {
      return NextResponse.json({
        domain,
        whoisExists: false,
        reason: 'WHOIS information does not exists.',
        nameComUrl,
      });
    }
    const whois = extractWhoisSummary(payload);

    return NextResponse.json({
      domain,
      whoisExists: true,
      reason: 'WHOIS information found.',
      nameComUrl,
      whois,
    });
  } catch (error) {
    return NextResponse.json({
      domain,
      whoisExists: false,
      reason: 'WHOIS information does not exists.',
      details: error instanceof Error ? error.message : 'Unknown error',
      nameComUrl,
    });
  }
}
