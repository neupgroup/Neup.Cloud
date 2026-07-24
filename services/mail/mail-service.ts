/*
::neup.documentation::mail-service

Server-side mail service operations.

::private

Resolves sender and receiver SSH targets from EMAIL_* environment variables. When both
password and private key are configured, private key authentication is used.

::private end
::end
*/

'use server';

import dns from 'dns/promises';
import { runCommandOnServerWithAuth } from '@/services/server/ssh';

type MailServerRole = 'sender' | 'receiver';

type MailSshTarget = {
  host: string;
  username: string;
  privateKey: string;
  password?: string;
};

type MailServiceConfigSummary = {
  senderHost: string;
  senderUser: string;
  senderAuth: 'private key' | 'password' | 'not configured';
  receiverHost: string;
  receiverUser: string;
};

type MailDnsCheckItem = {
  key: 'mx' | 'spf' | 'dkim' | 'dmarc';
  label: string;
  ok: boolean;
  message: string;
  records: string[];
  guide?: {
    type: 'MX' | 'TXT';
    name: string;
    value: string;
    note: string;
  };
};

export type MailDnsCheckKey = MailDnsCheckItem['key'];

export type MailDnsCheckResult = {
  domain: string;
  authoritativeNameservers: string[];
  ok: boolean;
  checks: MailDnsCheckItem[];
};

type AuthoritativeMailDnsContext = {
  domain: string;
  nameservers: string[];
  addresses: string[];
};

const EXPECTED_MX_HOST = 'mail.neupgroup.com';

function envValue(name: string): string {
  return process.env[name]?.trim() ?? '';
}

function normalizeDnsName(value: string): string {
  return value.trim().toLowerCase().replace(/\.$/, '');
}

function flattenTxtRecords(records: string[][]): string[] {
  return records.map((record) => record.join(''));
}

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values));
}

async function getNameserverAddresses(nameserver: string): Promise<string[]> {
  const addresses = await Promise.all([
    dns.resolve4(nameserver).catch(() => []),
    dns.resolve6(nameserver).catch(() => []),
  ]);

  return addresses.flat();
}

async function getAuthoritativeNameservers(domain: string): Promise<{ nameservers: string[]; addresses: string[] }> {
  const nameservers = (await dns.resolveNs(domain))
    .map(normalizeDnsName)
    .sort();

  const addressGroups = await Promise.all(nameservers.map(getNameserverAddresses));
  const addresses = uniqueValues(addressGroups.flat());

  return { nameservers, addresses };
}

async function resolveMxAuthoritative(name: string, nameserverAddresses: string[]): Promise<string[]> {
  const results = await Promise.all(nameserverAddresses.map(async (nameserverAddress) => {
    const resolver = new dns.Resolver();
    resolver.setServers([nameserverAddress]);

    try {
      return await resolver.resolveMx(name);
    } catch {
      return [];
    }
  }));

  return uniqueValues(results
    .flat()
    .sort((a, b) => a.priority - b.priority)
    .map((record) => `${record.priority} ${normalizeDnsName(record.exchange)}`));
}

async function resolveTxtRecords(name: string, nameserverAddresses: string[]): Promise<string[]> {
  const results = await Promise.all(nameserverAddresses.map(async (nameserverAddress) => {
    const resolver = new dns.Resolver();
    resolver.setServers([nameserverAddress]);

    try {
      return flattenTxtRecords(await resolver.resolveTxt(name));
    } catch {
      return [];
    }
  }));

  return uniqueValues(results.flat());
}

function getDkimSelectors(): string[] {
  const raw = envValue('EMAIL_DKIM_SELECTORS') || envValue('EMAIL_DKIM_SELECTOR') || 'default,mail';
  const selectors = raw
    .split(',')
    .map((selector) => selector.trim())
    .filter(Boolean);

  return Array.from(new Set(selectors));
}

function getDkimRecordValue(): string {
  return envValue('EMAIL_DKIM_RECORD_VALUE') || envValue('EMAIL_DKIM_PUBLIC_KEY');
}

function createMailDnsGuide(
  key: MailDnsCheckItem['key'],
  domain: string,
  selectors: string[] = getDkimSelectors()
): MailDnsCheckItem['guide'] {
  if (key === 'mx') {
    return {
      type: 'MX',
      name: '@',
      value: `10 ${EXPECTED_MX_HOST}`,
      note: `Keep this as an MX record on the ${domain} domain.`,
    };
  }

  if (key === 'spf') {
    return {
      type: 'TXT',
      name: '@',
      value: `v=spf1 mx include:${EXPECTED_MX_HOST} -all`,
      note: `Keep this as a TXT record on the ${domain} domain root.`,
    };
  }

  if (key === 'dmarc') {
    return {
      type: 'TXT',
      name: `_dmarc`,
      value: `v=DMARC1; p=none`,
      note: `Keep this as a TXT record on _dmarc.${domain}.`,
    };
  }

  const selector = selectors[0] || 'default';
  const dkimValue = getDkimRecordValue();

  return {
    type: 'TXT',
    name: `${selector}._domainkey`,
    value: dkimValue || 'v=DKIM1; k=rsa; p=<paste-public-key-from-neup-mail>',
    note: dkimValue
      ? `Keep this as a TXT record on ${selector}._domainkey.${domain}.`
      : `Keep this as a TXT record on ${selector}._domainkey.${domain}, replacing the placeholder with the DKIM public key from Neup.Mail.`,
  };
}

function getMailSshTarget(role: MailServerRole): MailSshTarget {
  const prefix = role === 'sender' ? 'EMAIL_SENDER' : 'EMAIL_RECEIVER';
  const host = envValue(`${prefix}_HOST`);
  const username = envValue(`${prefix}_SSH_USER`);
  const password = envValue(`${prefix}_SSH_PASS`);
  const privateKey = envValue(`${prefix}_SSH_PRIVATE_KEY`);

  if (!host) {
    throw new Error(`${prefix}_HOST is not configured.`);
  }

  if (!username) {
    throw new Error(`${prefix}_SSH_USER is not configured.`);
  }

  if (!privateKey && !password) {
    throw new Error(`${prefix}_SSH_PASS or ${prefix}_SSH_PRIVATE_KEY must be configured.`);
  }

  return {
    host,
    username,
    privateKey,
    password: privateKey ? undefined : password,
  };
}

export async function getMailServiceConfigSummary(): Promise<MailServiceConfigSummary> {
  const senderPrivateKey = envValue('EMAIL_SENDER_SSH_PRIVATE_KEY');
  const senderPassword = envValue('EMAIL_SENDER_SSH_PASS');

  return {
    senderHost: envValue('EMAIL_SENDER_HOST'),
    senderUser: envValue('EMAIL_SENDER_SSH_USER'),
    senderAuth: senderPrivateKey ? 'private key' : senderPassword ? 'password' : 'not configured',
    receiverHost: envValue('EMAIL_RECEIVER_HOST'),
    receiverUser: envValue('EMAIL_RECEIVER_SSH_USER'),
  };
}

async function getAuthoritativeMailDnsContext(domain: string): Promise<AuthoritativeMailDnsContext> {
  const normalizedDomain = normalizeDnsName(domain);

  if (!normalizedDomain) {
    return {
      domain: normalizedDomain,
      nameservers: [],
      addresses: [],
    };
  }

  try {
    const authoritative = await getAuthoritativeNameservers(normalizedDomain);
    return {
      domain: normalizedDomain,
      nameservers: authoritative.nameservers,
      addresses: authoritative.addresses,
    };
  } catch {
    return {
      domain: normalizedDomain,
      nameservers: [],
      addresses: [],
    };
  }
}

function createNameserverFailureCheck(context: AuthoritativeMailDnsContext): MailDnsCheckItem {
  return {
    key: 'mx',
    label: 'Authoritative nameservers',
    ok: false,
    message: context.nameservers.length > 0
      ? 'Authoritative nameservers were found, but their IP addresses could not be resolved.'
      : 'Authoritative nameservers could not be resolved for this domain.',
    records: context.nameservers,
  };
}

async function checkMxRecord(context: AuthoritativeMailDnsContext): Promise<MailDnsCheckItem> {
  const mxRecords = await resolveMxAuthoritative(context.domain, context.addresses);

  const mxPointsToNeupMail = mxRecords.some((record) => {
    const [, ...exchangeParts] = record.split(' ');
    return normalizeDnsName(exchangeParts.join(' ')) === EXPECTED_MX_HOST;
  });

  return {
    key: 'mx',
    label: 'MX record',
    ok: mxPointsToNeupMail,
    message: mxPointsToNeupMail
      ? `MX points to ${EXPECTED_MX_HOST}.`
      : `MX must point to ${EXPECTED_MX_HOST}.`,
    records: mxRecords,
    guide: mxPointsToNeupMail ? undefined : createMailDnsGuide('mx', context.domain),
  };
}

async function checkSpfRecord(context: AuthoritativeMailDnsContext): Promise<MailDnsCheckItem> {
  const rootTxtRecords = await resolveTxtRecords(context.domain, context.addresses);
  const spfRecords = rootTxtRecords.filter((record) => /^v=spf1\b/i.test(record.trim()));
  const spfIsValid = spfRecords.some((record) => {
    const normalized = record.toLowerCase();
    return normalized.includes(`include:${EXPECTED_MX_HOST}`) || /\bmx\b/.test(normalized);
  });

  return {
    key: 'spf',
    label: 'SPF record',
    ok: spfIsValid,
    message: spfIsValid
      ? 'SPF record is present.'
      : spfRecords.length > 0
        ? `SPF record is present but does not allow ${EXPECTED_MX_HOST}.`
        : 'SPF TXT record is missing at the domain root.',
    records: spfRecords,
    guide: spfIsValid ? undefined : createMailDnsGuide('spf', context.domain),
  };
}

async function checkDmarcRecord(context: AuthoritativeMailDnsContext): Promise<MailDnsCheckItem> {
  const dmarcRecords = (await resolveTxtRecords(`_dmarc.${context.domain}`, context.addresses))
    .filter((record) => /^v=dmarc1\b/i.test(record.trim()));

  return {
    key: 'dmarc',
    label: 'DMARC record',
    ok: dmarcRecords.length > 0,
    message: dmarcRecords.length > 0
      ? 'DMARC record is present.'
      : `DMARC TXT record is missing at _dmarc.${context.domain}.`,
    records: dmarcRecords,
    guide: dmarcRecords.length > 0 ? undefined : createMailDnsGuide('dmarc', context.domain),
  };
}

async function checkDkimRecord(context: AuthoritativeMailDnsContext): Promise<MailDnsCheckItem> {
  const selectors = getDkimSelectors();
  const dkimRecordsBySelector = await Promise.all(selectors.map(async (selector) => {
    const name = `${selector}._domainkey.${context.domain}`;
    const records = (await resolveTxtRecords(name, context.addresses)).filter((record) => /^v=dkim1\b/i.test(record.trim()));
    return { selector, records };
  }));
  const dkimRecords = dkimRecordsBySelector.flatMap((entry) => entry.records.map((record) => `${entry.selector}: ${record}`));

  return {
    key: 'dkim',
    label: 'DKIM record',
    ok: dkimRecords.length > 0,
    message: dkimRecords.length > 0
      ? 'DKIM record is present.'
      : `DKIM TXT record is missing for selector ${selectors.join(' or ')}.`,
    records: dkimRecords,
    guide: dkimRecords.length > 0 ? undefined : createMailDnsGuide('dkim', context.domain, selectors),
  };
}

async function checkMailDnsItem(context: AuthoritativeMailDnsContext, key: MailDnsCheckKey): Promise<MailDnsCheckItem> {
  if (!context.domain) {
    return {
      key,
      label: key.toUpperCase() + ' record',
      ok: false,
      message: 'Select a domain before checking mail DNS.',
      records: [],
    };
  }

  if (context.addresses.length === 0) {
    return createNameserverFailureCheck(context);
  }

  if (key === 'mx') return checkMxRecord(context);
  if (key === 'spf') return checkSpfRecord(context);
  if (key === 'dmarc') return checkDmarcRecord(context);
  return checkDkimRecord(context);
}

export async function checkMailDnsRecord(domain: string, key: MailDnsCheckKey): Promise<MailDnsCheckResult> {
  const context = await getAuthoritativeMailDnsContext(domain);
  const check = await checkMailDnsItem(context, key);

  return {
    domain: context.domain,
    authoritativeNameservers: context.nameservers,
    ok: check.ok,
    checks: [check],
  };
}

export async function checkMailDns(domain: string): Promise<MailDnsCheckResult> {
  const context = await getAuthoritativeMailDnsContext(domain);
  const checks: MailDnsCheckItem[] = [];

  if (!context.domain) {
    return {
      domain: context.domain,
      authoritativeNameservers: [],
      ok: false,
      checks: [{
        key: 'mx',
        label: 'MX record',
        ok: false,
        message: 'Select a domain before checking mail DNS.',
        records: [],
      }],
    };
  }

  if (context.addresses.length === 0) {
    return {
      domain: context.domain,
      authoritativeNameservers: context.nameservers,
      ok: false,
      checks: [createNameserverFailureCheck(context)],
    };
  }

  const mxCheck = await checkMxRecord(context);
  checks.push(mxCheck);

  if (!mxCheck.ok) {
    return {
      domain: context.domain,
      authoritativeNameservers: context.nameservers,
      ok: false,
      checks,
    };
  }

  checks.push(await checkSpfRecord(context));
  checks.push(await checkDmarcRecord(context));
  checks.push(await checkDkimRecord(context));

  return {
    domain: context.domain,
    authoritativeNameservers: context.nameservers,
    ok: checks.every((check) => check.ok),
    checks,
  };
}

export async function checkMailSenderPort25() {
  const target = getMailSshTarget('sender');
  const command = 'nc -vz gmail-smtp-in.l.google.com 25';

  try {
    if (!target.privateKey && !target.password) {
      return { error: 'EMAIL_SENDER_SSH_PRIVATE_KEY is empty and EMAIL_SENDER_SSH_PASS is not visible to the running app process. Restart the app after changing .env.' };
    }

    const result = await runCommandOnServerWithAuth({
      host: target.host,
      username: target.username,
      privateKey: target.privateKey,
      password: target.password,
      command,
      skipSwap: true,
      variables: {},
    });

    const output = result.stdout + (result.stderr ? `\n${result.stderr}` : '');

    return {
      output,
      error: result.code !== 0 ? output || `Command exited with code ${result.code}` : undefined,
      exitCode: result.code,
    };
  } catch (error: any) {
    return { error: error.message };
  }
}
