/**
 * Python Application Commands
 * Unified command definitions for Python applications
 */

import { sanitizeAppName } from './universal';
import { getStartOrRestartSupervisorServiceScript, getStopMatchingSupervisorServicesScript, getPortCheckScript } from './supervisor';
import type { CommandContext, CommandDefinition } from './command-types';
export type { CommandContext, CommandDefinition } from './command-types';

/**
 * Get all commands for Python applications
 * Simply add a new object to this array to add a new command!
 */
export const getCommands = (context: CommandContext): CommandDefinition[] => {
    const sanitizedAppName = sanitizeAppName(context.appName);
    const supervisorServiceName = context.supervisorServiceName || sanitizedAppName;
    const stopMatchingServicesScript = getStopMatchingSupervisorServicesScript(context.applicationId);
    const refreshSupervisorServiceScript = getStartOrRestartSupervisorServiceScript(supervisorServiceName);
    const portsStr = context.preferredPorts?.join(' ') || '';
    const entryFile = context.entryFile || 'main.py';

    const portCheckScript = getPortCheckScript(portsStr);
    const preStartScript = `${stopMatchingServicesScript}\n\n${portCheckScript}`.trim();

    return [
        // Build/Install Command
        {
            title: 'Build',
            description: 'Install dependencies for the Python application',
            icon: 'Hammer',
            status: 'published',
            type: 'normal',
            command: {
                mainCommand: `cd ${context.appLocation} && 
                if [ -f requirements.txt ]; then 
                    pip3 install -r requirements.txt; 
                fi`
            }
        },

        // Start Command (Production)
        {
            title: 'Start',
            description: 'Start the Python application using Supervisor',
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
command=python3 ${context.appLocation}/${entryFile}
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
            description: 'Stop the running Python application',
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
            description: 'Restart the Python application with latest changes',
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
export const getStartCommand = (appName: string, appLocation: string, entryFile: string = 'main.py', preferredPorts: number[] = [], supervisorServiceName?: string, applicationId?: string) => {
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
