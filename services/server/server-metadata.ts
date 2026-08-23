export type ServerMetadata = {
  validTill?: string | null;
  expiresAt?: string | null;
  sshAuthMethod?: 'privateKey' | 'password' | null;
  sshPassphrase?: string | null;
  sshPassword?: string | null;
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

  if (typeof merged.sshPassphrase === 'string') {
    const trimmed = merged.sshPassphrase.trim();
    merged.sshPassphrase = trimmed.length > 0 ? trimmed : undefined;
  }

  if (typeof merged.sshPassword === 'string') {
    const trimmed = merged.sshPassword.trim();
    merged.sshPassword = trimmed.length > 0 ? trimmed : undefined;
  }

  Object.keys(merged).forEach((key) => {
    if (merged[key] === undefined) {
      delete merged[key];
    }
  });

  return JSON.stringify(merged);
}

export function getServerExpiration(value?: string | null) {
  const metadata = parseServerMetadata(value);
  return metadata.validTill ?? metadata.expiresAt ?? null;
}

export function isServerDisabled(value?: string | null) {
  const metadata = parseServerMetadata(value);
  const disabled = metadata.disabled;

  return (
    disabled === true ||
    (typeof disabled === 'string' && disabled.trim().toLowerCase() === 'true') ||
    (typeof metadata.status === 'string' && metadata.status.trim().toLowerCase() === 'disabled')
  );
}

export function getServerSshPassphrase(value?: string | null) {
  const raw = parseServerMetadata(value).sshPassphrase;
  if (typeof raw !== 'string') {
    return raw ?? null;
  }

  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getServerSshPassword(value?: string | null) {
  const raw = parseServerMetadata(value).sshPassword;
  if (typeof raw !== 'string') {
    return raw ?? null;
  }

  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getServerSshAuthMethod(value?: string | null): 'privateKey' | 'password' {
  const raw = parseServerMetadata(value).sshAuthMethod;
  return raw === 'password' ? 'password' : 'privateKey';
}

export function stripSensitiveServerMetadata(value?: string | null) {
  const metadata = parseServerMetadata(value);
  delete metadata.sshPassphrase;
  delete metadata.sshPassword;

  return Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null;
}
