'use server';

import { getServerForRunner } from '@/services/server/server-service';
import { runCommandOnServer } from '@/services/server/ssh';
import { updateServer } from '@/services/server/server-service';
import { getServerById } from '@/services/server/data';
import {
    SWAP_DIR,
    PERSISTENT_SWAP_PREFIX,
    DYNAMIC_SWAP_PREFIX,
    persistentSwapPath,
} from '@/services/server/swap-paths';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SwapFileEntry = {
    path: string;
    name: string;
    kind: 'persistent' | 'dynamic' | 'unknown';
    /** Size in bytes as reported by the filesystem, 0 if unknown */
    sizeBytes: number;
    /** Whether the file is currently active in /proc/swaps */
    active: boolean;
    /** Whether it has an /etc/fstab entry */
    inFstab: boolean;
};

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getRecurringSwapSize(serverId: string): Promise<{ sizeMb: number; error?: string }> {
    const server = await getServerById(serverId);
    if (!server) return { sizeMb: 0, error: 'Server not found.' };

    try {
        const parsed = server.moreDetails ? JSON.parse(server.moreDetails) : {};
        const sizeMb = typeof parsed.recurringSwapMb === 'number' && Number.isFinite(parsed.recurringSwapMb)
            ? Math.max(0, Math.floor(parsed.recurringSwapMb))
            : 0;
        return { sizeMb };
    } catch {
        return { sizeMb: 0 };
    }
}

export async function listSwapFiles(serverId: string): Promise<{ files: SwapFileEntry[]; error?: string }> {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username || !server.privateKey) {
        return { files: [], error: 'Server not found or missing SSH credentials.' };
    }

    // Outputs one line per file: <path> <size_bytes> <active 0|1> <in_fstab 0|1>
    // active: checks /proc/swaps first column (awk to be robust against whitespace)
    // Also scans legacy root-level swap files so nothing is missed
    const script = `
SUDO=""
if command -v sudo >/dev/null 2>&1; then
    # Use non-interactive sudo when possible (avoids hanging on password prompt)
    if sudo -n true >/dev/null 2>&1; then
        SUDO="sudo -n"
    fi
fi

list_file() {
    f="$1"
    # Missing/non-file targets are not an error (globs may not match).
    if [ -n "$SUDO" ]; then
        $SUDO test -f "$f" 2>/dev/null || return 0
    else
        [ -f "$f" ] || return 0
    fi

    if [ -n "$SUDO" ]; then
        SIZE=$($SUDO stat -c '%s' "$f" 2>/dev/null || echo 0)
    else
        SIZE=$(stat -c '%s' "$f" 2>/dev/null || echo 0)
    fi
    ACTIVE=0
    awk 'NR>1 {print $1}' /proc/swaps 2>/dev/null | grep -qxF "$f" && ACTIVE=1
    FSTAB=0
    grep -qF "$f" /etc/fstab 2>/dev/null && FSTAB=1
    echo "$f $SIZE $ACTIVE $FSTAB"
    return 0
}

# Active swaps (includes swaps created outside our managed paths)
# /proc/swaps columns: Filename Type Size(kiB) Used(kiB) Priority
list_active_swaps() {
    awk 'NR>1 {print $1 " " $3}' /proc/swaps 2>/dev/null | while read -r SWAP_PATH SIZE_KIB; do
        [ -n "$SWAP_PATH" ] || continue
        SIZE_BYTES=$((SIZE_KIB * 1024))
        FSTAB=0
        grep -qF "$SWAP_PATH" /etc/fstab 2>/dev/null && FSTAB=1
        echo "$SWAP_PATH $SIZE_BYTES 1 $FSTAB"
    done
}

# Print active swaps first so they always show up
list_active_swaps

	# Managed directory
	if [ -n "$SUDO" ]; then
	    # find is robust even when the directory is 700/root-owned
	    $SUDO find "${SWAP_DIR}" -maxdepth 1 -type f -print 2>/dev/null | while read -r f; do
	        list_file "$f"
	    done
	else
    if [ -d "${SWAP_DIR}" ]; then
        for f in "${SWAP_DIR}"/*; do
            list_file "$f"
        done
    fi
fi

# Legacy root-level files (created before /swapper directory was introduced)
for f in /swapfile_persistent /swapfile_cmd_[0-9]*; do
    list_file "$f"
done

exit 0
`.trim();

    try {
        const result = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            script,
            undefined,
            undefined,
            true
        );

        if (result.code !== 0) {
            return { files: [], error: result.stderr || 'Failed to list swap files.' };
        }

        const output = result.stdout.trim();
        if (!output) {
            return { files: [] };
        }

        const seen = new Set<string>();
        const files: SwapFileEntry[] = output.split('\n')
            .map((line) => {
                const parts = line.trim().split(/\s+/);
                const path = parts[0] ?? '';
                if (!path || seen.has(path)) return null;
                seen.add(path);

                const sizeBytes = parseInt(parts[1] ?? '0', 10) || 0;
                const active = parts[2] === '1';
                const inFstab = parts[3] === '1';
                const name = path.split('/').pop() ?? path;

                let kind: SwapFileEntry['kind'] = 'unknown';
                if (name.startsWith(PERSISTENT_SWAP_PREFIX) || name === 'swapfile_persistent') kind = 'persistent';
                else if (name.startsWith(DYNAMIC_SWAP_PREFIX) || name.startsWith('swapfile_cmd_')) kind = 'dynamic';

                return { path, name, kind, sizeBytes, active, inFstab };
            })
            .filter((f): f is SwapFileEntry => f !== null);

        return { files };
    } catch (e: any) {
        return { files: [], error: e.message };
    }
}

// ─── Create / Delete ──────────────────────────────────────────────────────────

export async function createRecurringSwap(
    serverId: string,
    sizeMb: number
): Promise<{ success?: boolean; error?: string }> {
    if (!Number.isFinite(sizeMb) || sizeMb < 1) {
        return { error: 'Swap size must be at least 1 MB.' };
    }

    const server = await getServerForRunner(serverId);
    if (!server || !server.username || !server.privateKey) {
        return { error: 'Server not found or missing SSH credentials.' };
    }

    const normalizedMb = Math.floor(sizeMb);
    // Generate the path server-side (includes random suffix)
    const swapPath = persistentSwapPath(normalizedMb);

    const script = `
set -e

sudo mkdir -p "${SWAP_DIR}"
sudo chmod 700 "${SWAP_DIR}"

# Remove any existing persistent swap files
for f in "${SWAP_DIR}/${PERSISTENT_SWAP_PREFIX}"*; do
    [ -f "$f" ] || continue
    sudo swapoff "$f" 2>/dev/null || true
    sudo sed -i "\\|$f|d" /etc/fstab 2>/dev/null || true
    sudo rm -f "$f"
done

SWAP_FILE="${swapPath}"

if ! sudo fallocate -l ${normalizedMb}M "$SWAP_FILE" 2>/dev/null; then
    sudo dd if=/dev/zero of="$SWAP_FILE" bs=1M count=${normalizedMb} status=none
fi

sudo chmod 600 "$SWAP_FILE"
sudo mkswap "$SWAP_FILE"
sudo swapon "$SWAP_FILE"

sudo sed -i "\\|${SWAP_DIR}/${PERSISTENT_SWAP_PREFIX}|d" /etc/fstab
echo "${swapPath} none swap sw 0 0" | sudo tee -a /etc/fstab > /dev/null

echo "OK"
`.trim();

    try {
        const result = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            script,
            undefined,
            undefined,
            true
        );

        if (result.code !== 0) {
            return { error: result.stderr || `Command failed with exit code ${result.code}` };
        }

        await saveRecurringSwapToDetails(serverId, normalizedMb, server.moreDetails);
        return { success: true };
    } catch (e: any) {
        return { error: e.message };
    }
}

export async function deleteRecurringSwap(
    serverId: string
): Promise<{ success?: boolean; error?: string }> {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username || !server.privateKey) {
        return { error: 'Server not found or missing SSH credentials.' };
    }

    const script = `
for f in "${SWAP_DIR}/${PERSISTENT_SWAP_PREFIX}"*; do
    [ -f "$f" ] || continue
    sudo swapoff "$f" 2>/dev/null || true
    sudo sed -i "\\|$f|d" /etc/fstab 2>/dev/null || true
    sudo rm -f "$f"
done
echo "OK"
`.trim();

    try {
        const result = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            script,
            undefined,
            undefined,
            true
        );

        if (result.code !== 0) {
            return { error: result.stderr || `Command failed with exit code ${result.code}` };
        }

        await saveRecurringSwapToDetails(serverId, 0, server.moreDetails);
        return { success: true };
    } catch (e: any) {
        return { error: e.message };
    }
}

export async function deleteSwapFile(
    serverId: string,
    filePath: string
): Promise<{ success?: boolean; error?: string }> {
    // Safety: only allow absolute, whitespace-free paths (matches our list output format).
    if (!filePath.startsWith('/') || /\s/.test(filePath)) {
        return { error: 'Invalid swap path.' };
    }

    const server = await getServerForRunner(serverId);
    if (!server || !server.username || !server.privateKey) {
        return { error: 'Server not found or missing SSH credentials.' };
    }

    const shQuote = (value: string) => `'${value.replace(/'/g, `'\"'\"'`)}'`;

    const script = `
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

f=${shQuote(filePath)}

# Only allow deleting swaps that are either:
# - currently active in /proc/swaps (user-created swap files), OR
# - known managed locations (swapper directory / legacy files)
ACTIVE=0
awk 'NR>1 {print $1}' /proc/swaps 2>/dev/null | grep -qxF "$f" && ACTIVE=1
MANAGED=0
case "$f" in
    "${SWAP_DIR}/"*|/swapfile_persistent|/swapfile_cmd_[0-9]*)
        MANAGED=1
        ;;
esac

if [ "$ACTIVE" != "1" ] && [ "$MANAGED" != "1" ]; then
    echo "Swap path is not recognized."
    exit 4
fi

# Disable swap first (safe even if not active)
$SUDO swapoff "$f" 2>/dev/null || true
$SUDO sed -i "\\|$f|d" /etc/fstab 2>/dev/null || true

# Remove only if it is a regular file (devices can't be deleted here)
if $SUDO test -f "$f" 2>/dev/null; then
    $SUDO rm -f "$f" 2>/dev/null || true
fi

echo "OK"
	`.trim();

    try {
        const result = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            script,
            undefined,
            undefined,
            true
        );

        if (result.code !== 0) {
            return { error: result.stderr || result.stdout || `Command failed with exit code ${result.code}` };
        }

        const name = filePath.split('/').pop() ?? '';
        if (name.startsWith(PERSISTENT_SWAP_PREFIX) || name === 'swapfile_persistent') {
            await saveRecurringSwapToDetails(serverId, 0, server.moreDetails);
        }

        return { success: true };
    } catch (e: any) {
        return { error: e.message };
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function saveRecurringSwapToDetails(
    serverId: string,
    sizeMb: number,
    existingMoreDetails: string | null | undefined
) {
    try {
        const parsed = existingMoreDetails ? JSON.parse(existingMoreDetails) : {};
        const updated = JSON.stringify({ ...parsed, recurringSwapMb: sizeMb });
        await updateServer(serverId, { moreDetails: updated });
    } catch {
        await updateServer(serverId, {
            moreDetails: JSON.stringify({ recurringSwapMb: sizeMb }),
        });
    }
}
