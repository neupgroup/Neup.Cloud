/**
 * Node.js Application Commands
 * Unified command definitions for Node.js applications
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
 * Get all commands for Node.js applications
 * Simply add a new object to this array to add a new command!
 */
export const getCommands = (context: CommandContext): CommandDefinition[] => {
    const sanitizedAppName = sanitizeAppName(context.appName);
    const portsStr = context.preferredPorts?.join(' ') || '';
    const entryFile = context.entryFile || 'index.js';

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
            description: 'Build the application for production',
            icon: 'Hammer',
            status: 'published',
            type: 'normal',
            command: {
                preCommand: portFinderScript,
                mainCommand: `cd ${context.appLocation} && 
                PORT=$CHOSEN_PORT npm install && 
                if grep -q "\\"build\\":" "package.json"; then PORT=$CHOSEN_PORT npm run build; fi`
            }
        },

        // Start Command (Production)
        {
            title: 'Start',
            description: 'Start the application in production mode using Supervisor',
            icon: 'PlayCircle',
            status: 'published',
            type: 'success',
            command: {
                preCommand: portFinderScript,
                mainCommand: `
# Ensure Supervisor is installed
if ! command -v supervisorctl &> /dev/null; then
    echo "Supervisor not found. Installing..."
    sudo DEBIAN_FRONTEND=noninteractive apt-get update
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y supervisor
    sudo systemctl enable supervisor
    sudo systemctl start supervisor
fi

sudo mkdir -p /etc/supervisor/conf.d/

CONF_FILE="/etc/supervisor/conf.d/${sanitizedAppName}.conf"
LOG_OUT="${context.appLocation}/terminal.output.log"
LOG_ERR="${context.appLocation}/terminal.error.log"
USER_NAME=$(whoami)

cat <<EOF | sudo tee $CONF_FILE
[program:${sanitizedAppName}]
command=node ${context.appLocation}/${entryFile}
directory=${context.appLocation}
user=$USER_NAME
autostart=true
autorestart=true
startsecs=3
stopasgroup=true
killasgroup=true
stderr_logfile=$LOG_ERR
stdout_logfile=$LOG_OUT
environment=PORT="$CHOSEN_PORT",NODE_ENV="production"
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
            description: 'Stop the running application',
            icon: 'StopCircle',
            status: 'published',
            type: 'destructive',
            command: {
                mainCommand: `sudo supervisorctl stop ${sanitizedAppName}
sudo rm /etc/supervisor/conf.d/${sanitizedAppName}.conf
sudo supervisorctl reread
sudo supervisorctl update`
            }
        }
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
export const getStartCommand = (appName: string, appLocation: string, entryFile: string = 'index.js', preferredPorts: number[] = []) => {
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

export const getBuildCommand = (appLocation: string) => {
    const commands = getCommands({ appName: '', appLocation });
    const cmd = commands.find(c => c.title === 'Build');
    return cmd?.command.mainCommand || '';
};
