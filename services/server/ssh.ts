
'use server';

import { NodeSSH } from 'node-ssh';
import { UniversalLinux } from '@/services/core/universal';
import { prisma } from '#/core/database/prisma';
import { connectServerWithPassword } from '@/services/server/auth/password';
import { connectServerWithPrivateKey } from '@/services/server/auth/privatekey';
import { getServerSshPassphrase, getServerSshPassword } from '@/services/server/server-metadata';
import { SWAP_DIR, dynamicSwapPath } from '@/services/server/swap-paths';

const DEFAULT_SWAP_SIZE_MB = 2048;

export type SshExecutionRequest = {
    host: string;
    username: string;
    privateKey?: string;
    password?: string;
    command: string;
    onStdout?: (chunk: Buffer | string) => void;
    onStderr?: (chunk: Buffer | string) => void;
    variables?: Record<string, string | number | boolean>;
    passphrase?: string;
};

export type SshExecutionResult = {
    stdout: string;
    stderr: string;
    code: number | null;
};

export type SshExecutionRecorder = (entry: {
    command: string;
    stdout: string;
    stderr: string;
    code: number | null;
}) => Promise<void> | void;

export interface ISshCommandExecutor {
    run(request: SshExecutionRequest): Promise<SshExecutionResult>;
}

async function createConnectedSsh(config: {
    host: string;
    username: string;
    privateKey?: string;
    password?: string;
    passphrase?: string;
}): Promise<NodeSSH> {
    const privateKey = config.privateKey?.trim();

    if (privateKey) {
        return connectServerWithPrivateKey({
            host: config.host,
            username: config.username,
            privateKey,
            passphrase: config.passphrase,
        });
    }

    const password = config.password?.trim();
    if (password) {
        return connectServerWithPassword({
            host: config.host,
            username: config.username,
            password,
        });
    }

    throw new Error('No SSH private key or password configured.');
}

function parseSwapSizeMb(moreDetails: string | null | undefined): number {
    if (!moreDetails) {
        return DEFAULT_SWAP_SIZE_MB;
    }

    try {
        const parsed = JSON.parse(moreDetails) as { swapSizeMb?: unknown; swapSize?: unknown };
        if (typeof parsed.swapSizeMb === 'number' && Number.isFinite(parsed.swapSizeMb)) {
            // 0 is valid — means "skip swap"
            return Math.max(0, Math.floor(parsed.swapSizeMb));
        }

        if (typeof parsed.swapSize === 'string' && parsed.swapSize.trim()) {
            const legacyMatch = parsed.swapSize.trim().toUpperCase().match(/^(\d+)([MGT])$/);
            if (legacyMatch) {
                const amount = Number(legacyMatch[1]);
                const unit = legacyMatch[2];

                if (unit === 'M') return Math.max(1, amount);
                if (unit === 'G') return Math.max(1, amount * 1024);
                return Math.max(1, Math.ceil(amount / 1024));
            }
        }
    } catch {
        const parsed = Number(moreDetails.trim());
        if (Number.isFinite(parsed) && parsed >= 0) {
            return Math.floor(parsed);
        }
    }

    return DEFAULT_SWAP_SIZE_MB;
}

async function getSwapSizeForServer(
    host: string,
    username: string,
    privateKey?: string | null
): Promise<number> {
    const server = await prisma.server.findFirst({
        where: {
            publicIp: host,
            username,
            privateKey: privateKey || null,
        },
    }) as { moreDetails: string | null } | null;

    return parseSwapSizeMb(server?.moreDetails);
}

async function getStoredAuthenticationForServer(
    host: string,
    username: string,
    privateKey?: string | null
): Promise<{ passphrase?: string; password?: string }> {
    const server = await prisma.server.findFirst({
        where: {
            publicIp: host,
            username,
            privateKey: privateKey || null,
        },
        select: {
            moreDetails: true,
        },
    });

    return {
        passphrase: getServerSshPassphrase(server?.moreDetails) ?? undefined,
        password: getServerSshPassword(server?.moreDetails) ?? undefined,
    };
}

async function forceCleanupSwapFile(
    host: string,
    username: string,
    privateKey: string,
    swapFile: string,
    passphrase?: string,
    password?: string
): Promise<void> {
    let cleanupSsh: NodeSSH | null = null;

    try {
        cleanupSsh = await createConnectedSsh({
            host,
            username,
            privateKey,
            passphrase,
            password,
        });

        await cleanupSsh.execCommand(`sudo swapoff "${swapFile}" 2>/dev/null || true; sudo rm -f "${swapFile}" 2>/dev/null || true`);
    } catch {
        // Best-effort cleanup only: cancellation can also drop connectivity.
    } finally {
        cleanupSsh?.dispose();
    }
}

class BaseSshCommandExecutor implements ISshCommandExecutor {
    constructor(private readonly recorder?: SshExecutionRecorder) {}

    async run(request: SshExecutionRequest): Promise<SshExecutionResult> {
        let ssh: NodeSSH | null = null;
        try {
            ssh = await createConnectedSsh({
                host: request.host,
                username: request.username,
                privateKey: request.privateKey,
                passphrase: request.passphrase,
                password: request.password,
            });

            const connectedSsh = ssh;
            if (!connectedSsh) {
                throw new Error('SSH connection was not established.');
            }

            const executor = async (cmd: string) => {
                return await connectedSsh.execCommand(cmd);
            };

            let command = request.command;
            command = command.replace(/{{NEUP_SERVER_RAM_TOTAL}}/g, "$(grep MemTotal /proc/meminfo | awk '{print $2}')");
            command = command.replace(/{{NEUP_SERVER_RAM_AVAILABLE}}/g, "$(grep MemAvailable /proc/meminfo | awk '{print $2}')");

            const universal = new UniversalLinux({ variables: request.variables ?? {} }, executor);
            const processedCommand = await universal.process(command);
            const result = await connectedSsh.execCommand(processedCommand, {
                onStdout: request.onStdout,
                onStderr: request.onStderr,
            });

            const executionResult: SshExecutionResult = {
                stdout: result.stdout,
                stderr: result.stderr,
                code: result.code,
            };

            if (this.recorder) {
                await this.recorder({
                    command: processedCommand,
                    stdout: executionResult.stdout,
                    stderr: executionResult.stderr,
                    code: executionResult.code,
                });
            }

            return executionResult;
        } finally {
            ssh?.dispose();
        }
    }
}

class DynamicSwapSshCommandExecutor implements ISshCommandExecutor {
    private readonly baseExecutor: BaseSshCommandExecutor;

    constructor(recorder?: SshExecutionRecorder) {
        this.baseExecutor = new BaseSshCommandExecutor(recorder);
    }

    async run(request: SshExecutionRequest): Promise<SshExecutionResult> {
        let swapFilePath: string | null = null;
        const privateKey = request.privateKey ?? '';
        try {
            const swapSizeInMegabytes = await getSwapSizeForServer(request.host, request.username, privateKey);
            let wrappedCommand = request.command;

            if (swapSizeInMegabytes > 0) {
                const uniqueId = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
                swapFilePath = dynamicSwapPath(swapSizeInMegabytes, uniqueId);

                wrappedCommand = `
                sudo mkdir -p "${SWAP_DIR}" 2>/dev/null || true
                sudo chmod 700 "${SWAP_DIR}" 2>/dev/null || true
                SWAP_FILE="${swapFilePath}";
                HAS_SWAP=0

                if sudo fallocate -l ${swapSizeInMegabytes}M "$SWAP_FILE" 2>/dev/null || sudo dd if=/dev/zero of="$SWAP_FILE" bs=1M count=${swapSizeInMegabytes} status=none; then
                    sudo chmod 600 "$SWAP_FILE";
                    if sudo mkswap "$SWAP_FILE" >/dev/null 2>&1; then
                        if sudo swapon "$SWAP_FILE" >/dev/null 2>&1; then
                            HAS_SWAP=1
                        fi
                    fi
                fi

                cleanup() {
                    if [ "$HAS_SWAP" = "1" ]; then
                        sudo swapoff "$SWAP_FILE" 2>/dev/null
                        sudo rm -f "$SWAP_FILE" 2>/dev/null
                    else
                        sudo rm -f "$SWAP_FILE" 2>/dev/null
                    fi
                }
                trap cleanup EXIT
                trap 'cleanup; exit 130' INT TERM HUP

                ${request.command}
            `;
            }

            const result = await this.baseExecutor.run({
                ...request,
                command: wrappedCommand,
            });

            if (swapFilePath && result.code !== 0) {
                await forceCleanupSwapFile(
                    request.host,
                    request.username,
                    privateKey,
                    swapFilePath,
                    request.passphrase,
                    request.password
                );
            }

            return result;
        } catch (error) {
            if (swapFilePath) {
                await forceCleanupSwapFile(
                    request.host,
                    request.username,
                    privateKey,
                    swapFilePath,
                    request.passphrase,
                    request.password
                );
            }

            throw error;
        }
    }
}

function createBaseSshExecutor(recorder?: SshExecutionRecorder): ISshCommandExecutor {
    return new BaseSshCommandExecutor(recorder);
}

function createDynamicSwapSshExecutor(recorder?: SshExecutionRecorder): ISshCommandExecutor {
    return new DynamicSwapSshCommandExecutor(recorder);
}

export async function runCommandOnServer(
    host: string,
    username: string,
    privateKey: string | null | undefined,
    command: string,
    onStdout?: (chunk: Buffer | string) => void,
    onStderr?: (chunk: Buffer | string) => void,
    skipSwap: boolean = false,
    variables: Record<string, string | number | boolean> = {},
    passphrase?: string,
    recorder?: SshExecutionRecorder,
    password?: string
): Promise<{ stdout: string; stderr: string; code: number | null }> {
    const executor: ISshCommandExecutor = skipSwap
        ? createBaseSshExecutor(recorder)
        : createDynamicSwapSshExecutor(recorder);

    const storedAuthentication = await getStoredAuthenticationForServer(host, username, privateKey);
    const resolvedPassphrase = passphrase ?? storedAuthentication.passphrase;
    const resolvedPassword = password ?? storedAuthentication.password;

    return executor.run({
        host,
        username,
        privateKey: privateKey ?? undefined,
        command,
        onStdout,
        onStderr,
        variables,
        passphrase: resolvedPassphrase,
        password: resolvedPassword,
    });
}

export async function runCommandOnServerWithAuth(request: SshExecutionRequest & {
    skipSwap?: boolean;
    recorder?: SshExecutionRecorder;
}): Promise<{ stdout: string; stderr: string; code: number | null }> {
    const executor: ISshCommandExecutor = request.skipSwap
        ? createBaseSshExecutor(request.recorder)
        : createDynamicSwapSshExecutor(request.recorder);

    return executor.run(request);
}

export async function uploadFileToServer(
    host: string,
    username: string,
    privateKey: string | null | undefined,
    localPath: string,
    remotePath: string,
    passphrase?: string
): Promise<void> {
    let ssh: NodeSSH | null = null;
    const storedAuthentication = await getStoredAuthenticationForServer(host, username, privateKey);
    try {
        ssh = await createConnectedSsh({
            host,
            username,
            privateKey: privateKey ?? undefined,
            passphrase: passphrase ?? storedAuthentication.passphrase,
            password: storedAuthentication.password,
        });
        await ssh.putFile(localPath, remotePath);
    } finally {
        ssh?.dispose();
    }
}

export async function uploadDirectoryToServer(
    host: string,
    username: string,
    privateKey: string | null | undefined,
    localPath: string,
    remotePath: string,
    passphrase?: string
): Promise<void> {
    let ssh: NodeSSH | null = null;
    const storedAuthentication = await getStoredAuthenticationForServer(host, username, privateKey);
    try {
        ssh = await createConnectedSsh({
            host,
            username,
            privateKey: privateKey ?? undefined,
            passphrase: passphrase ?? storedAuthentication.passphrase,
            password: storedAuthentication.password,
        });
        await ssh.putDirectory(localPath, remotePath, {
            recursive: true,
            concurrency: 10,
        });
    } finally {
        ssh?.dispose();
    }
}

export async function downloadFileFromServer(
    host: string,
    username: string,
    privateKey: string | null | undefined,
    remotePath: string,
    localPath: string,
    passphrase?: string
): Promise<void> {
    let ssh: NodeSSH | null = null;
    const storedAuthentication = await getStoredAuthenticationForServer(host, username, privateKey);
    try {
        ssh = await createConnectedSsh({
            host,
            username,
            privateKey: privateKey ?? undefined,
            passphrase: passphrase ?? storedAuthentication.passphrase,
            password: storedAuthentication.password,
        });
        await ssh.getFile(localPath, remotePath);
    } finally {
        ssh?.dispose();
    }
}
