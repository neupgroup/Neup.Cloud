/**
 * Go Application Commands
 * Unified command definitions for Go applications
 */

import { sanitizeAppName } from './universal';
import { getStartOrRestartSupervisorServiceScript, getStopMatchingSupervisorServicesScript, getPortCheckScript } from './supervisor';
import type { CommandContext, CommandDefinition } from './command-types';
export type { CommandContext, CommandDefinition } from './command-types';

/**
 * Get all commands for Go applications
 * Simply add a new object to this array to add a new command!
 */
export const getCommands = (context: CommandContext): CommandDefinition[] => {
    const sanitizedAppName = sanitizeAppName(context.appName);
    const supervisorServiceName = context.supervisorServiceName || sanitizedAppName;
    const stopMatchingServicesScript = getStopMatchingSupervisorServicesScript(context.applicationId);
    const refreshSupervisorServiceScript = getStartOrRestartSupervisorServiceScript(supervisorServiceName);
    const portsStr = context.preferredPorts?.join(' ') || '';
    const isExecutable = context.locationType === 'executable';
    // For Go, entryFile might be main.go, or the directory '.'
    const entryFile = context.entryFile || '.';
    const runtimeEntryFile = entryFile.replace(/^\.\//, '');
    // We'll use the sanitizedAppName as the binary name
    // User request: use the same name for the build as well (preserve case/length if possible)
    // UPDATE: User requested to use the exact same name for consistency with supervisor service
    const binaryName = sanitizedAppName;
    const startCommand = isExecutable
        ? `${context.appLocation}/${runtimeEntryFile}`
        : `${context.appLocation}/${binaryName}`;

    const portCheckScript = getPortCheckScript(portsStr);
    const preStartScript = `${stopMatchingServicesScript}\n\n${portCheckScript}`.trim();

    return [
        ...(
            isExecutable
                ? []
                : [{
                    title: 'Build',
                    description: 'Build the Go application',
                    icon: 'Hammer',
                    status: 'published' as const,
                    type: 'normal' as const,
                    command: {
                        preCommand: null,
                        mainCommand: `cd ${context.appLocation} && 
                go mod tidy && 
                go build -o ${binaryName} ${entryFile}`
                    }
                }]
        ),

        // Start Command (Production)
        {
            title: 'Start',
            description: isExecutable
                ? 'Start the Go executable using Supervisor'
                : 'Start the Go application using Supervisor',
            icon: 'PlayCircle',
            status: 'published',
            type: 'success',
            command: {
                preCommand: preStartScript,
                mainCommand: `CONF_FILE="/etc/supervisor/conf.d/${supervisorServiceName}.conf"
LOG_OUT="${context.appLocation}/terminal.output.log"
LOG_ERR="${context.appLocation}/terminal.error.log"
USER_NAME=$(whoami)

cat <<EOF | sudo tee $CONF_FILE
[program:${supervisorServiceName}]
command=${startCommand}
directory=${context.appLocation}
user=$USER_NAME
autostart=true
autorestart=true
startsecs=3
stopasgroup=true
killasgroup=true
stderr_logfile=$LOG_ERR
stdout_logfile=$LOG_OUT
environment=PORT="$CHOSEN_PORT"
EOF

${refreshSupervisorServiceScript}
`
            }
        },

        // Stop Command
        {
            title: 'Stop',
            description: 'Stop the running Go application',
            icon: 'StopCircle',
            status: 'published',
            type: 'destructive',
            command: {
                mainCommand: `${stopMatchingServicesScript}`
            }
        },

        // Restart Command
        {
            title: 'Restart',
            description: 'Restart the Go application',
            icon: 'RefreshCw',
            status: 'published',
            type: 'normal',
            command: {
                mainCommand: `${stopMatchingServicesScript}
${refreshSupervisorServiceScript}`
            }
        },
    ];
};

/**
 * Get all commands as a keyed object (for backward compatibility)
 */
export const getAllCommands = (context: CommandContext): Record<string, CommandDefinition> => {
    const commands = getCommands(context);
    const result: Record<string, CommandDefinition> = {};

    commands.forEach(cmd => {
        const key = cmd.title.toLowerCase();
        result[key] = cmd;
    });

    return result;
};

/**
 * Legacy compatibility functions
 */
export const getStartCommand = (appName: string, appLocation: string, entryFile: string = '.', preferredPorts: number[] = [], supervisorServiceName?: string, applicationId?: string) => {
    const commands = getCommands({ appName, appLocation, entryFile, preferredPorts, supervisorServiceName, applicationId });
    const cmd = commands.find(c => c.title === 'Start');
    if (!cmd) return '';
    return `${cmd.command.preCommand || ''}\n${cmd.command.mainCommand}`;
};

export const getStopCommand = (appName: string, supervisorServiceName?: string, applicationId?: string) => {
    const commands = getCommands({ appName, appLocation: '', supervisorServiceName, applicationId });
    const cmd = commands.find(c => c.title === 'Stop');
    return cmd?.command.mainCommand || '';
};

export const getBuildCommand = (appName: string, appLocation: string, entryFile: string = '.') => {
    const commands = getCommands({ appName, appLocation, entryFile });
    const cmd = commands.find(c => c.title === 'Build');
    return cmd?.command.mainCommand || '';
};
