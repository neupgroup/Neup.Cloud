
'use server';

import { getServerForRunner } from '@/services/server/server-service';
import { runCommandOnServer } from '@/services/server/ssh';
import { revalidatePath } from 'next/cache';


const STATUS_DIR = "/.status";
const PID_FILE = `${STATUS_DIR}/status.pid`;
const CPU_LOG = `${STATUS_DIR}/cpu.usage`;
const RAM_LOG = `${STATUS_DIR}/ram.usage`;
const NET_LOG = `${STATUS_DIR}/network.usage`;
const TEMP_LOG = `${STATUS_DIR}/temperature.usage`;

const SCRIPT_CONTENT = `
SUDO=""
if command -v sudo >/dev/null 2>&1; then
    if sudo -n true >/dev/null 2>&1; then
        SUDO="sudo -n"
    fi
fi

if [ -z "$SUDO" ]; then
    echo "This action requires passwordless sudo on the server."
    exit 3
fi

$SUDO mkdir -p ${STATUS_DIR}
$SUDO chmod 755 ${STATUS_DIR} 2>/dev/null || true
echo $$ | $SUDO tee ${PID_FILE} > /dev/null

cleanup() {
    echo "Stopping status tracking..."
    $SUDO rm -f ${PID_FILE} 2>/dev/null || true
    exit 0
}
trap cleanup SIGINT SIGTERM

# Detect Interface
IFACE=$(ip route | grep default | awk '{print $5}' | head -n1)
if [ -z "$IFACE" ]; then IFACE=$(ls /sys/class/net | grep -v lo | head -n1); fi

get_net_bytes() {
    grep "$IFACE" /proc/net/dev | sed 's/:/ /' | awk '{print $2, $10}'
}

get_temp_c() {
    if command -v sensors > /dev/null 2>&1; then
        sensor_temp=$(sensors 2>/dev/null | awk 'match($0, /([+-]?[0-9]+([.][0-9]+)?)°C/, m) { gsub(/^\+/, "", m[1]); print m[1]; exit }')
        if [ -n "$sensor_temp" ]; then
            echo "$sensor_temp"
            return
        fi
    fi

    zone_temp=$(awk 'BEGIN { max = "" } { if ($1 ~ /^[0-9]+$/) { val = $1 / 1000; if (max == "" || val > max) max = val } } END { if (max != "") printf "%.1f\n", max }' /sys/class/thermal/thermal_zone*/temp 2>/dev/null)
    if [ -n "$zone_temp" ]; then
        echo "$zone_temp"
        return
    fi

    echo "nan"
}

# Initialize previous values
read PREV_RX PREV_TX <<< $(get_net_bytes)

echo "Starting status tracking in the background..."
while true; do
    ts=$(date +%s)

    # CPU usage: user, system, idle
    cpu_info=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\\([0-9.]*\\)%* id.*/\\1/" | awk '{print 100 - $1}')
    echo "$ts $cpu_info" | $SUDO tee -a ${CPU_LOG} > /dev/null

    # RAM usage: total, used, free
    ram_info=$(free -m | grep Mem | awk '{print $2, $3, $4}')
    echo "$ts $ram_info" | $SUDO tee -a ${RAM_LOG} > /dev/null

    # Temperature usage: celsius
    temp_info=$(get_temp_c)
    echo "$ts $temp_info" | $SUDO tee -a ${TEMP_LOG} > /dev/null
    
    # Network usage: calc delta
    read CURR_RX CURR_TX <<< $(get_net_bytes)
    DIFF_RX=$((CURR_RX - PREV_RX))
    DIFF_TX=$((CURR_TX - PREV_TX))
    
    # Basic check for overflow/reset
    if [ $DIFF_RX -lt 0 ]; then DIFF_RX=0; fi
    if [ $DIFF_TX -lt 0 ]; then DIFF_TX=0; fi
    
    echo "$ts $DIFF_RX $DIFF_TX" | $SUDO tee -a ${NET_LOG} > /dev/null
    
    PREV_RX=$CURR_RX
    PREV_TX=$CURR_TX
    
    sleep 60
done
`;

export async function startStatusTracking(serverId: string) {
    const server = await getServerForRunner(serverId);
    if (!server || server.type !== 'Linux') {
        return { error: 'This feature is only for Linux servers.' };
    }
    if (!server.username || !server.privateKey) {
        return { error: 'Server SSH configuration is missing.' };
    }

    const command = `nohup bash -c '${SCRIPT_CONTENT.replace(/'/g, "'\\''")}' > /dev/null 2>&1 &`;

    try {
        await runCommandOnServer(server.publicIp, server.username, server.privateKey, command);
        revalidatePath('/server/status');
        return { success: true };
    } catch (e: any) {
        return { error: `Failed to start tracking: ${e.message}` };
    }
}

export async function stopStatusTracking(serverId: string) {
    const server = await getServerForRunner(serverId);
    if (!server) return { error: 'Server not found.' };
    if (!server.username || !server.privateKey) return { error: 'Server SSH configuration is missing.' };

    const command = `sudo systemctl stop neup-logger`;

    try {
        const result = await runCommandOnServer(server.publicIp, server.username, server.privateKey, command);
        revalidatePath('/server/status');
        if (result.code !== 0) {
            return { error: result.stderr || 'Failed to stop the service.' };
        }
        return { success: true };
    } catch (e: any) {
        return { error: `Failed to stop tracking: ${e.message}` };
    }
}


export type StatusData = {
    isTracking: boolean;
    cpuHistory: { timestamp: number; usage: number }[];
    ramHistory: { timestamp: number; used: number; total: number }[];
    temperatureSupported: boolean;
    temperatureHistory: { timestamp: number; celsius: number | null }[];
    networkHistory: { timestamp: number; incoming: number; outgoing: number }[];
};

export async function getStatus(
    serverId: string,
    endTime?: number,
    durationMinutes: number = 60
): Promise<{ data?: StatusData; error?: string }> {
    const server = await getServerForRunner(serverId);
    if (!server) return { error: 'Server not found.' };
    if (!server.username || !server.privateKey) return { error: 'Server SSH configuration is missing.' };

    const endTs = endTime || Date.now();
    const startTs = endTs - (durationMinutes * 60 * 1000);

    // Convert to seconds for comparison with log timestamps
    const startSec = Math.floor(startTs / 1000);
    const endSec = Math.floor(endTs / 1000);

    const checkPidCmd = `if pgrep -f neup-logger > /dev/null; then echo "active"; else echo "inactive"; fi`;


    let intervalSec = 0;
    if (durationMinutes <= 60) {
        intervalSec = 0;
    } else if (durationMinutes <= 360) { // 6h -> 15m
        intervalSec = 15 * 60;
    } else if (durationMinutes <= 720) { // 12h -> 30m
        intervalSec = 30 * 60;
    } else if (durationMinutes <= 1440) { // 24h -> 30m
        intervalSec = 30 * 60;
    } else if (durationMinutes <= 10080) { // 7d -> 4h
        intervalSec = 240 * 60;
    } else { // 30d -> 12h
        intervalSec = 720 * 60;
    }

    // Use awk to filter and aggregate by timestamp range
    const sudoPrefix = 'sudo -n';

    const readCpuCmd = intervalSec === 0
        ? `${sudoPrefix} awk -v start=${startSec} -v end=${endSec} '$1 >= start && $1 <= end' ${CPU_LOG} 2>/dev/null`
        : `${sudoPrefix} awk -v start=${startSec} -v end=${endSec} -v interval=${intervalSec} '
            $1 >= start && $1 <= end {
                bin = int($1 / interval) * interval;
                sum[bin] += $2;
                count[bin]++;
            }
            END {
                for (b in sum) print b, sum[b]/count[b]
            }
           ' ${CPU_LOG} 2>/dev/null | sort -n`;

    const readRamCmd = intervalSec === 0
        ? `${sudoPrefix} awk -v start=${startSec} -v end=${endSec} '$1 >= start && $1 <= end' ${RAM_LOG} 2>/dev/null`
        : `${sudoPrefix} awk -v start=${startSec} -v end=${endSec} -v interval=${intervalSec} '
            $1 >= start && $1 <= end {
                bin = int($1 / interval) * interval;
                sumTotal[bin] += $2;
                sumUsed[bin] += $3;
                count[bin]++;
            }
            END {
                for (b in sumUsed) print b, int(sumTotal[b]/count[b]), int(sumUsed[b]/count[b])
            }
           ' ${RAM_LOG} 2>/dev/null | sort -n`;

    const readNetCmd = intervalSec === 0
        ? `${sudoPrefix} awk -v start=${startSec} -v end=${endSec} '$1 >= start && $1 <= end' ${NET_LOG} 2>/dev/null`
        : `${sudoPrefix} awk -v start=${startSec} -v end=${endSec} -v interval=${intervalSec} '
            $1 >= start && $1 <= end {
                bin = int($1 / interval) * interval;
                sumRX[bin] += $2;
                sumTX[bin] += $3;
                count[bin]++;
            }
            END {
                for (b in sumRX) print b, int(sumRX[b]/count[b]), int(sumTX[b]/count[b])
            }
           ' ${NET_LOG} 2>/dev/null | sort -n`;

    const checkTempSupportCmd = `${sudoPrefix} awk '$2 != "nan" { print "supported"; exit 0 } END { print "unsupported" }' ${TEMP_LOG} 2>/dev/null || echo "unsupported"`;

    const readTempCmd = intervalSec === 0
        ? `${sudoPrefix} awk -v start=${startSec} -v end=${endSec} '$1 >= start && $1 <= end { print $1, $2 }' ${TEMP_LOG} 2>/dev/null | sort -n`
        : `${sudoPrefix} awk -v start=${startSec} -v end=${endSec} -v interval=${intervalSec} '
            $1 >= start && $1 <= end {
                bin = int($1 / interval) * interval;
                if ($2 != "nan") { sumTemp[bin] += $2; count[bin]++; }
            }
            END {
                binStart = int(start / interval) * interval;
                for (b = binStart; b <= end; b += interval) {
                    if (count[b] > 0) printf "%s %.2f\\n", b, sumTemp[b]/count[b];
                    else print b, "nan";
                }
            }
           ' ${TEMP_LOG} 2>/dev/null | sort -n`;

    try {
        const [pidResult, cpuResult, ramResult, netResult, tempSupportResult, tempResult] = await Promise.all([
            runCommandOnServer(server.publicIp, server.username, server.privateKey, checkPidCmd),
            runCommandOnServer(server.publicIp, server.username, server.privateKey, readCpuCmd),
            runCommandOnServer(server.publicIp, server.username, server.privateKey, readRamCmd),
            runCommandOnServer(server.publicIp, server.username, server.privateKey, readNetCmd),
            runCommandOnServer(server.publicIp, server.username, server.privateKey, checkTempSupportCmd),
            runCommandOnServer(server.publicIp, server.username, server.privateKey, readTempCmd),
        ]);

        const isTracking = pidResult.stdout.trim() === 'active';
        const temperatureSupported = tempSupportResult.stdout.trim() === 'supported';

        const cpuHistory = cpuResult.stdout.trim().split('\n').filter(Boolean).map(line => {
            const [timestamp, usage] = line.split(' ');
            return { timestamp: parseInt(timestamp) * 1000, usage: parseFloat(usage) };
        });

        const ramHistory = ramResult.stdout.trim().split('\n').filter(Boolean).map(line => {
            const [timestamp, total, used] = line.split(' ');
            return { timestamp: parseInt(timestamp) * 1000, used: parseInt(used), total: parseInt(total) };
        });

        const networkHistory = netResult.stdout.trim().split('\n').filter(Boolean).map(line => {
            const [timestamp, rx, tx] = line.split(' ');
            // Convert bytes to MB
            return {
                timestamp: parseInt(timestamp) * 1000,
                incoming: parseFloat((parseInt(rx) / (1024 * 1024)).toFixed(2)),
                outgoing: parseFloat((parseInt(tx) / (1024 * 1024)).toFixed(2))
            };
        });

        const temperatureHistory = tempResult.stdout.trim().split('\n').filter(Boolean).map(line => {
            const [timestamp, celsius] = line.split(' ');
            const parsedCelsius = parseFloat(celsius);
            return {
                timestamp: parseInt(timestamp) * 1000,
                celsius: Number.isFinite(parsedCelsius) ? parsedCelsius : null
            };
        });

        return { data: { isTracking, cpuHistory, ramHistory, temperatureSupported, temperatureHistory, networkHistory } };

    } catch (e: any) {
        return { error: `Failed to get status: ${e.message}` };
    }
}

export async function getServerUptime(serverId: string) {
    const server = await getServerForRunner(serverId);
    if (!server) return { error: 'Server not found.' };
    if (!server.username || !server.privateKey) return { error: 'Server SSH configuration is missing.' };

    try {
        const result = await runCommandOnServer(server.publicIp, server.username, server.privateKey, 'uptime -p', undefined, undefined, true);
        if (result.code !== 0) {
            return { error: result.stderr || 'Failed to get uptime' };
        }
        return { uptime: result.stdout.replace('up ', '').trim() };
    } catch (e: any) {
        return { error: e.message };
    }
}
