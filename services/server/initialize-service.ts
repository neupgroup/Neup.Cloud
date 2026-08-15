/*
::neup.documentation::server-initialize-service
::title Server Initialize Service

Server-side checks used by the server initialization workflow.

::public

Use these functions to inspect initialization readiness for a selected server.

::public end

::private

The checks execute read-only SSH commands and external port probes. Installation
actions stay in the existing system requirement pages.

::private end

::end
*/

'use server';

import { checkPortConnectivity } from '@/services/server/firewall/firewall-service';
import { executeCommand } from '@/services/server/commands/server-command-service';
import { requirements } from '@/services/server/requirement-list';
import { getServerForRunner } from '@/services/server/server-service';
import { runCommandOnServer, type SshExecutionResult } from '@/services/server/ssh';

const INITIALIZE_PORTS = [80, 443, 25, 5432] as const;

export type InitializePortNumber = (typeof INITIALIZE_PORTS)[number];

export type InitializePortCheck = {
  port: InitializePortNumber;
  status: 'open' | 'closed' | 'blocked' | 'error';
  message: string;
  latency?: number;
};

export type InitializeInstallationCheck = {
  checked: boolean;
  installed: boolean;
  status: 'installed' | 'not_installed' | 'error';
  title: string;
  message: string;
  output?: string;
};

export type InitializeApplicationLauncherChecks = {
  pm2: InitializeInstallationCheck;
  supervisor: InitializeInstallationCheck;
};

export type InitializeMode = 'onboard' | 'repair';

export type InitializeInstallTarget = 'pm2' | 'supervisor' | 'system-logger';

export type InitializeInstallResult = {
  success: boolean;
  message: string;
};

async function installRequirementSteps(
  serverId: string,
  target: InitializeInstallTarget,
  mode: InitializeMode
): Promise<InitializeInstallResult> {
  const requirement = requirements.find((item) => item.id === target);
  if (!requirement) {
    return {
      success: false,
      message: 'Initialization requirement is not configured.',
    };
  }

  if (mode === 'repair') {
    for (let index = requirement.steps.length - 1; index >= 0; index -= 1) {
      const step = requirement.steps[index];
      const uninstallCommand = step.uninstallCommand?.trim();
      if (!uninstallCommand) {
        continue;
      }

      const result = await executeCommand(
        serverId,
        uninstallCommand,
        `Repair ${requirement.title}: remove ${step.name}`,
        uninstallCommand,
        `initialize:${target}:repair:remove`
      );

      if (result.error) {
        return {
          success: false,
          message: result.error,
        };
      }
    }
  }

  for (const step of requirement.steps) {
    const existing = await runReadOnlyInitializeCommand(serverId, step.checkCommand);
    const existingResult = 'result' in existing ? existing.result : undefined;
    if (existingResult?.code === 0) {
      continue;
    }

    const installCommand = step.installCommand?.trim();
    if (!installCommand) {
      continue;
    }

    const result = await executeCommand(
      serverId,
      installCommand,
      `Initialize ${requirement.title}: ${step.name}`,
      installCommand,
      `initialize:${target}:${mode}`
    );

    if (result.error) {
      return {
        success: false,
        message: result.error,
      };
    }

    const verified = await runReadOnlyInitializeCommand(serverId, step.checkCommand);
    const verifiedResult = 'result' in verified ? verified.result : undefined;
    if (!verifiedResult || verifiedResult.code !== 0) {
      return {
        success: false,
        message: `${requirement.title} installation did not complete for step "${step.name}".`,
      };
    }
  }

  return {
    success: true,
    message: mode === 'repair'
      ? `${requirement.title} repaired successfully.`
      : `${requirement.title} installed successfully.`,
  };
}

async function runReadOnlyInitializeCommand(
  serverId: string,
  command: string
): Promise<{ result: SshExecutionResult; error?: never } | { result?: never; error: string }> {
  const server = await getServerForRunner(serverId);
  if (!server || !server.username) {
    return { error: 'Server or credentials not found.' };
  }

  try {
    const result = await runCommandOnServer(
      server.publicIp,
      server.username,
      server.privateKey,
      command,
      undefined,
      undefined,
      true,
      {}
    );

    return { result };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to run server check.' };
  }
}

export async function checkInitializePorts(serverId: string): Promise<InitializePortCheck[]> {
  return Promise.all(
    INITIALIZE_PORTS.map(async (port) => {
      const result = await checkPortConnectivity(serverId, port);
      return {
        port,
        status: result.status,
        message: result.message,
        latency: result.latency,
      };
    })
  );
}

async function checkSingleApplicationLauncher(
  serverId: string,
  definition: {
    command: string;
    installedTitle: string;
    missingTitle: string;
    installedFallbackMessage: string;
    missingFallbackMessage: string;
    errorTitle: string;
    errorFallbackMessage: string;
  }
): Promise<InitializeInstallationCheck> {
  const check = await runReadOnlyInitializeCommand(
    serverId,
    definition.command
  );

  if ('error' in check) {
    const message = check.error ?? definition.errorFallbackMessage;
    return {
      checked: true,
      installed: false,
      status: 'error',
      title: definition.errorTitle,
      message,
    };
  }

  const output = (check.result.stdout || check.result.stderr).trim();
  if (check.result.code === 0) {
    return {
      checked: true,
      installed: true,
      status: 'installed',
      title: definition.installedTitle,
      message: output || definition.installedFallbackMessage,
      output,
    };
  }

  return {
    checked: true,
    installed: false,
    status: 'not_installed',
    title: definition.missingTitle,
    message: definition.missingFallbackMessage,
    output,
  };
}

export async function checkInitializeApplicationLauncher(serverId: string): Promise<InitializeApplicationLauncherChecks> {
  const [pm2, supervisor] = await Promise.all([
    checkSingleApplicationLauncher(serverId, {
      command: 'bash -lc \'if command -v pm2 >/dev/null 2>&1; then echo "PM2 $(pm2 -v)"; exit 0; fi; echo "PM2 is not installed"; exit 1\'',
      installedTitle: 'PM2 installed',
      missingTitle: 'PM2 not installed',
      installedFallbackMessage: 'PM2 is installed.',
      missingFallbackMessage: 'PM2 is not installed. You can continue now and install it later from System Requirements.',
      errorTitle: 'PM2 check failed',
      errorFallbackMessage: 'PM2 check failed.',
    }),
    checkSingleApplicationLauncher(serverId, {
      command: 'bash -lc \'if command -v supervisord >/dev/null 2>&1; then echo "Supervisor $(supervisord --version)"; exit 0; fi; echo "Supervisor is not installed"; exit 1\'',
      installedTitle: 'Supervisor installed',
      missingTitle: 'Supervisor not installed',
      installedFallbackMessage: 'Supervisor is installed.',
      missingFallbackMessage: 'Supervisor is not installed. You can continue now and install it later from System Requirements.',
      errorTitle: 'Supervisor check failed',
      errorFallbackMessage: 'Supervisor check failed.',
    }),
  ]);

  return { pm2, supervisor };
}

export async function checkInitializeStatusLogger(serverId: string): Promise<InitializeInstallationCheck> {
  const check = await runReadOnlyInitializeCommand(
    serverId,
    [
      'bash -lc \'',
      'if sudo -n test -f /.status/logger.sh 2>/dev/null && systemctl list-unit-files 2>/dev/null | grep -q "^neup-logger.service" && sudo -n systemctl is-active --quiet neup-logger 2>/dev/null; then',
      '  echo "neup-logger is installed and running";',
      '  exit 0;',
      'fi;',
      'echo "neup-logger is not installed or not running";',
      'exit 1',
      '\'',
    ].join(' ')
  );

  if ('error' in check) {
    const message = check.error ?? 'Status logger check failed.';
    return {
      checked: true,
      installed: false,
      status: 'error',
      title: 'Status logger check failed',
      message,
    };
  }

  const output = (check.result.stdout || check.result.stderr).trim();
  if (check.result.code === 0) {
    return {
      checked: true,
      installed: true,
      status: 'installed',
      title: 'Status logger installed',
      message: output || 'The status logging application is installed and running.',
      output,
    };
  }

  return {
    checked: true,
    installed: false,
    status: 'not_installed',
    title: 'Status logger not installed',
    message: 'The status logging application is not installed yet. You can continue and add it later.',
    output,
  };
}

export async function installInitializeRequirement(
  serverId: string,
  target: InitializeInstallTarget
): Promise<InitializeInstallResult> {
  return installRequirementSteps(serverId, target, 'onboard');
}

export async function repairInitializeRequirement(
  serverId: string,
  target: InitializeInstallTarget
): Promise<InitializeInstallResult> {
  return installRequirementSteps(serverId, target, 'repair');
}
