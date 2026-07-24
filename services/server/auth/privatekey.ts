'use server';

import { NodeSSH } from 'node-ssh';

export type ServerPrivateKeyAuthConfig = {
  host: string;
  username: string;
  privateKey: string;
  passphrase?: string | null;
};

function normalizePrivateKeySecret(value?: string | null): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export async function connectServerWithPrivateKey(config: ServerPrivateKeyAuthConfig): Promise<NodeSSH> {
  const privateKey = normalizePrivateKeySecret(config.privateKey);
  const passphrase = normalizePrivateKeySecret(config.passphrase);

  if (!privateKey) {
    throw new Error('No SSH private key configured.');
  }

  let ssh = new NodeSSH();

  if (!passphrase) {
    try {
      await ssh.connect({
        host: config.host,
        username: config.username,
        privateKey,
      });

      return ssh;
    } catch (error) {
      ssh.dispose();
      throw error;
    }
  }

  try {
    await ssh.connect({
      host: config.host,
      username: config.username,
      privateKey,
      passphrase,
    });

    return ssh;
  } catch (error: any) {
    const message = String(error?.message ?? error ?? '');
    const authFailed = /all configured authentication methods failed/i.test(message);

    if (!authFailed) {
      ssh.dispose();
      throw error;
    }

    ssh.dispose();
    ssh = new NodeSSH();

    try {
      await ssh.connect({
        host: config.host,
        username: config.username,
        privateKey,
      });

      return ssh;
    } catch (fallbackError) {
      ssh.dispose();
      throw fallbackError;
    }
  }
}

