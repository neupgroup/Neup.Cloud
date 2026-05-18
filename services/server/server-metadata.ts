export type ServerMetadata = {
  expiresAt?: string | null;
  sshPassphrase?: string | null;
  [key: string]: unknown;
};

export function parseServerMetadata(value?: string | null): ServerMetadata {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as ServerMetadata;
    }
  } catch {
    return {};
  }

  return {};
}

export function serializeServerMetadata(existingValue: string | null | undefined, patch: ServerMetadata) {
  const merged = {
    ...parseServerMetadata(existingValue),
    ...patch,
  };

  Object.keys(merged).forEach((key) => {
    if (merged[key] === undefined) {
      delete merged[key];
    }
  });

  return JSON.stringify(merged);
}

export function getServerExpiration(value?: string | null) {
  return parseServerMetadata(value).expiresAt ?? null;
}

export function getServerSshPassphrase(value?: string | null) {
  return parseServerMetadata(value).sshPassphrase ?? null;
}

export function stripSensitiveServerMetadata(value?: string | null) {
  const metadata = parseServerMetadata(value);
  delete metadata.sshPassphrase;

  return Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null;
}
