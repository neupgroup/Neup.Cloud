'use server';

import { NodeSSH } from 'node-ssh';

export type ServerPasswordAuthConfig = {
  host: string;
  username: string;
  password: string;
};

function normalizePassword(value?: string | null): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export async function connectServerWithPassword(config: ServerPasswordAuthConfig): Promise<NodeSSH> {
  const password = normalizePassword(config.password);
  if (!password) {
    throw new Error('No SSH password configured.');
  }

  const ssh = new NodeSSH();
  try {
    await ssh.connect({
      host: config.host,
      username: config.username,
      password,
    });

    return ssh;
  } catch (error) {
    ssh.dispose();
    throw error;
  }
}

