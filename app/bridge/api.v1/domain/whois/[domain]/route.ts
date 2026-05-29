import { NextRequest, NextResponse } from 'next/server';
import { whoisDomain } from 'whoiser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DOMAIN_REGEX = /^(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/i;

type WhoisSummary = {
  domainName: string | null;
  registrar: string | null;
  whoisServer: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  expiresAt: string | null;
  nameservers: string[];
  statuses: string[];
  contacts: {
    registrant: WhoisContact | null;
    admin: WhoisContact | null;
    tech: WhoisContact | null;
    billing: WhoisContact | null;
  };
  raw: string;
};

type WhoisContact = {
  name: string | null;
  organization: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
};

function normalizeDomain(value: string): string {
  return value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
}

function looksLikeWhoisNotFound(raw: string): boolean {
  const negativeMarkers = [
    'no match for',
    'not found',
    'no data found',
    'status: free',
    'domain you requested is not known',
    'no entries found',
    'nothing found',
    'domain not found',
  ];

  const lower = raw.toLowerCase();
  return negativeMarkers.some((marker) => lower.includes(marker));
}

function readFirstString(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === 'string' && item.trim());
    return first ? first.trim() : null;
  }
  return null;
}

function readStringList(value: string | string[] | undefined): string[] {
  if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value)) return value.map((item) => item.trim()).filter(Boolean);
  return [];
}

type WhoisRecord = Record<string, string | string[] | undefined>;

function aggregateRecords(payload: Awaited<ReturnType<typeof whoisDomain>>): {
  merged: WhoisRecord;
  raw: string;
} {
  const records = Object.values(payload) as WhoisRecord[];
  const merged: WhoisRecord = {};
  const rawParts: string[] = [];

  for (const record of records) {
    for (const [key, value] of Object.entries(record)) {
      if (key === 'text') continue;

      const current = merged[key];
      if (!current) {
        merged[key] = value;
        continue;
      }

      const currentList = readStringList(current);
      const nextList = readStringList(value);
      const combined = [...new Set([...currentList, ...nextList])];
      merged[key] = combined.length <= 1 ? (combined[0] ?? '') : combined;
    }

    const textEntries = readStringList(record.text);
    if (textEntries.length > 0) rawParts.push(textEntries.join('\n'));
  }

  return {
    merged,
    raw: rawParts.join('\n\n'),
  };
}

function createLowerKeyMap(record: WhoisRecord): Map<string, string | string[] | undefined> {
  const map = new Map<string, string | string[] | undefined>();
  for (const [key, value] of Object.entries(record)) {
    map.set(key.toLowerCase().trim(), value);
  }
  return map;
}

function readCaseInsensitive(map: Map<string, string | string[] | undefined>, keys: string[]): string | null {
  for (const key of keys) {
    const value = readFirstString(map.get(key.toLowerCase().trim()));
    if (value) return value;
  }
  return null;
}

function readListCaseInsensitive(map: Map<string, string | string[] | undefined>, keys: string[]): string[] {
  const values: string[] = [];
  for (const key of keys) {
    const next = readStringList(map.get(key.toLowerCase().trim()));
    values.push(...next);
  }
  return [...new Set(values)];
}

function readRawField(raw: string, patterns: string[]): string | null {
  for (const pattern of patterns) {
    const regex = new RegExp(`^\\s*${pattern}\\s*:\\s*(.+)$`, 'gim');
    const match = regex.exec(raw);
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return null;
}

function readContactField(
  map: Map<string, string | string[] | undefined>,
  raw: string,
  keys: string[],
  rawPatterns: string[]
): string | null {
  return readCaseInsensitive(map, keys) ?? readRawField(raw, rawPatterns);
}

function parseContact(
  map: Map<string, string | string[] | undefined>,
  raw: string,
  role: 'registrant' | 'admin' | 'tech' | 'billing'
): WhoisContact | null {
  const prefixMap: Record<'registrant' | 'admin' | 'tech' | 'billing', string[]> = {
    registrant: ['registrant'],
    admin: ['admin', 'administrative'],
    tech: ['tech', 'technical'],
    billing: ['billing'],
  };
  const prefixes = prefixMap[role];

  const contact: WhoisContact = {
    name: readContactField(
      map,
      raw,
      prefixes.flatMap((prefix) => [`${prefix} name`]),
      prefixes.flatMap((prefix) => [`${prefix}\\s+name`])
    ),
    organization: readContactField(
      map,
      raw,
      prefixes.flatMap((prefix) => [`${prefix} organization`, `${prefix} org`]),
      prefixes.flatMap((prefix) => [`${prefix}\\s+organization`, `${prefix}\\s+org`])
    ),
    email: readContactField(
      map,
      raw,
      prefixes.flatMap((prefix) => [`${prefix} email`]),
      prefixes.flatMap((prefix) => [`${prefix}\\s+email`])
    ),
    phone: readContactField(
      map,
      raw,
      prefixes.flatMap((prefix) => [`${prefix} phone`, `${prefix} phone number`]),
      prefixes.flatMap((prefix) => [`${prefix}\\s+phone`, `${prefix}\\s+phone\\s+number`])
    ),
    country: readContactField(
      map,
      raw,
      prefixes.flatMap((prefix) => [`${prefix} country`]),
      prefixes.flatMap((prefix) => [`${prefix}\\s+country`])
    ),
    state: readContactField(
      map,
      raw,
      prefixes.flatMap((prefix) => [`${prefix} state/province`, `${prefix} state`]),
      prefixes.flatMap((prefix) => [`${prefix}\\s+state\\/province`, `${prefix}\\s+state`])
    ),
    city: readContactField(
      map,
      raw,
      prefixes.flatMap((prefix) => [`${prefix} city`]),
      prefixes.flatMap((prefix) => [`${prefix}\\s+city`])
    ),
  };

  const hasData = Object.values(contact).some((value) => Boolean(value));
  return hasData ? contact : null;
}

function parseWhoiserResult(domain: string, payload: Awaited<ReturnType<typeof whoisDomain>>): WhoisSummary {
  const { merged, raw: aggregatedRaw } = aggregateRecords(payload);
  const map = createLowerKeyMap(merged);
  const raw = aggregatedRaw || JSON.stringify(payload, null, 2);

  return {
    domainName: readCaseInsensitive(map, ['domain name', 'domain']) ?? domain,
    registrar: readCaseInsensitive(map, ['registrar', 'sponsoring registrar']),
    whoisServer: readCaseInsensitive(map, ['whois server']),
    createdAt:
      readCaseInsensitive(map, ['creation date', 'created on', 'registered on', 'domain registration date']) ??
      readRawField(raw, ['Creation Date', 'Created On', 'Registered On', 'Domain Registration Date']),
    updatedAt:
      readCaseInsensitive(map, ['updated date', 'last updated on', 'changed']) ??
      readRawField(raw, ['Updated Date', 'Last Updated On', 'Changed']),
    expiresAt:
      readCaseInsensitive(map, [
        'registry expiry date',
        'registrar registration expiration date',
        'expiry date',
        'expiration date',
        'expires on',
      ]) ?? readRawField(raw, [
        'Registry Expiry Date',
        'Registrar Registration Expiration Date',
        'Expiry Date',
        'Expiration Date',
        'Expires On',
      ]),
    nameservers: [...new Set(readListCaseInsensitive(map, ['name server', 'name servers', 'nserver']))],
    statuses: [...new Set(readListCaseInsensitive(map, ['domain status', 'status']))],
    contacts: {
      registrant: parseContact(map, raw, 'registrant'),
      admin: parseContact(map, raw, 'admin'),
      tech: parseContact(map, raw, 'tech'),
      billing: parseContact(map, raw, 'billing'),
    },
    raw,
  };
}

export async function GET(_request: NextRequest, context: { params: Promise<{ domain: string }> }) {
  const params = await context.params;
  const domain = normalizeDomain(params.domain || '');

  if (!DOMAIN_REGEX.test(domain)) {
    return NextResponse.json(
      {
        domain,
        whoisExists: false,
        reason: 'Invalid domain format',
        nameComUrl: `https://www.name.com/domain/search/${encodeURIComponent(domain)}`,
      },
      { status: 400 }
    );
  }

  const nameComUrl = `https://www.name.com/domain/search/${encodeURIComponent(domain)}`;

  try {
    const payload = await whoisDomain(domain, {
      follow: 2,
      timeout: 15000,
      raw: false,
    });

    const whois = parseWhoiserResult(domain, payload);
    if (looksLikeWhoisNotFound(whois.raw)) {
      return NextResponse.json({
        domain,
        whoisExists: false,
        reason: 'WHOIS information does not exists.',
        nameComUrl,
      });
    }

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
      nameComUrl,
      details: error instanceof Error ? error.message : 'Failed to run whois command',
    });
  }
}
