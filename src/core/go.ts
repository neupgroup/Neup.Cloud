/**
 * Go Application Commands
 * Unified command definitions for Go applications
 */

import { sanitizeAppName } from './universal';

export interface CommandDefinition {
    title: string;
    description: string;
    icon: string;
    status: 'published' | 'unpublished';
    type: 'normal' | 'destructive' | 'success';
    command: {
        preCommand?: string;
        mainCommand: string;
        postCommand?: string;
    };
}

export interface CommandContext {
    appName: string;
    appLocation: string;
    preferredPorts?: number[];
    entryFile?: string;
}

/**
 * Get all commands for Go applications
 * Simply add a new object to this array to add a new command!
 */
export const getCommands = (context: CommandContext): CommandDefinition[] => {
    const sanitizedAppName = sanitizeAppName(context.appName);
    const portsStr = context.preferredPorts?.join(' ') || '';
    // For Go, entryFile might be main.go, or the directory '.'
    const entryFile = context.entryFile || '.';
    // We'll use the sanitizedAppName as the binary name
    // User request: use the same name for the build as well (preserve case/length if possible)
    // UPDATE: User requested to use the exact same name for consistency with supervisor service
    const binaryName = sanitizedAppName;

    const portFinderScript = portsStr ? `
find_port() {
    local PORTS="${portsStr}"
    for port in $PORTS; do
        if ! (echo >/dev/tcp/127.0.0.1/$port) >/dev/null 2>&1; then
            echo $port
            return 0
        fi
    done
    # Fallback to random port
    while true; do
        local rand=$(( ( RANDOM % 10000 ) + 3000 ))
        if ! (echo >/dev/tcp/127.0.0.1/$rand) >/dev/null 2>&1; then
            echo $rand
            return 0
        fi
    done
}
CHOSEN_PORT=$(find_port "${portsStr}")
echo "Selected Port: $CHOSEN_PORT"
` : '';

    return [
        // Build Command
        {
            title: 'Build',
            description: 'Build the Go application',
            icon: 'Hammer',
            status: 'published',
            type: 'normal',
            command: {
                preCommand: portFinderScript,
                mainCommand: `cd ${context.appLocation} && 
                PORT=$CHOSEN_PORT go mod tidy && 
                PORT=$CHOSEN_PORT go build -o ${binaryName} ${entryFile}`
            }
        },

        // Start Command (Production)
        {
            title: 'Start',
            description: 'Start the Go application using Supervisor',
            icon: 'PlayCircle',
            status: 'published',
            type: 'success',
            command: {
                preCommand: portFinderScript,
                mainCommand: `
CONF_FILE="/etc/supervisor/conf.d/${sanitizedAppName}.conf"
LOG_OUT="${context.appLocation}/terminal.output.log"
LOG_ERR="${context.appLocation}/terminal.error.log"
USER_NAME=$(whoami)

cat <<EOF | sudo tee $CONF_FILE
[program:${sanitizedAppName}]
command=${context.appLocation}/${binaryName}
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

sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl restart ${sanitizedAppName}
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
                mainCommand: `sudo supervisorctl stop ${sanitizedAppName}
sudo rm /etc/supervisor/conf.d/${sanitizedAppName}.conf
sudo supervisorctl reread
sudo supervisorctl update`
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
                mainCommand: `sudo supervisorctl restart "${sanitizedAppName}"`
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
export const getStartCommand = (appName: string, appLocation: string, entryFile: string = '.', preferredPorts: number[] = []) => {
    const commands = getCommands({ appName, appLocation, entryFile, preferredPorts });
    const cmd = commands.find(c => c.title === 'Start');
    if (!cmd) return '';
    return `${cmd.command.preCommand || ''}\n${cmd.command.mainCommand}`;
};

export const getStopCommand = (appName: string) => {
    const commands = getCommands({ appName, appLocation: '' });
    const cmd = commands.find(c => c.title === 'Stop');
    return cmd?.command.mainCommand || '';
};

export const getBuildCommand = (appName: string, appLocation: string, entryFile: string = '.') => {
    const commands = getCommands({ appName, appLocation, entryFile });
    const cmd = commands.find(c => c.title === 'Build');
    return cmd?.command.mainCommand || '';
};
