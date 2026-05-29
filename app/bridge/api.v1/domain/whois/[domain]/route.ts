import { NextRequest, NextResponse } from 'next/server';
import { firstResult, whoisDomain } from 'whoiser';

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
  raw: string;
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

function parseWhoiserResult(domain: string, payload: Awaited<ReturnType<typeof whoisDomain>>): WhoisSummary {
  const first = firstResult(payload);
  const raw = (first.text ?? []).join('\n') || JSON.stringify(payload, null, 2);

  return {
    domainName: readFirstString(first['Domain Name']) ?? domain,
    registrar: readFirstString(first.Registrar) ?? readFirstString(first['Sponsoring Registrar']),
    whoisServer: readFirstString(first['Whois Server']),
    createdAt: readFirstString(first['Creation Date']) ?? readFirstString(first['Created On']) ?? readFirstString(first['Registered On']) ?? readFirstString(first['Domain Registration Date']),
    updatedAt: readFirstString(first['Updated Date']) ?? readFirstString(first['Last Updated On']) ?? readFirstString(first.Changed),
    expiresAt: readFirstString(first['Registry Expiry Date']) ?? readFirstString(first['Registrar Registration Expiration Date']) ?? readFirstString(first['Expiry Date']) ?? readFirstString(first['Expiration Date']) ?? readFirstString(first['Expires On']),
    nameservers: [...new Set(readStringList(first['Name Server']).concat(readStringList(first.nserver)))],
    statuses: [...new Set(readStringList(first['Domain Status']).concat(readStringList(first.Status)))],
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
