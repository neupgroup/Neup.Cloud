'use server';

import { getServerForRunner } from '@/app/servers/actions';
import { runCommandOnServer } from '@/services/ssh';
import { revalidatePath } from 'next/cache';

export type SystemUser = {
    username: string;
    uid: string;
    gid: string;
    shell: string;
    home: string;
    description: string;
    type: 'system' | 'user' | 'root';
    groups?: string[];
};

export async function createUser(serverId: string, data: { username: string; password?: string; groups?: string }) {
    const server = await getServerForRunner(serverId);
    if (!server) return { error: 'Server not found' };

    const { username, password, groups } = data;

    try {
        // Create user
        // -m creates home directory
        // -s sets shell to /bin/bash (standard)
        let cmd = `sudo useradd -m -s /bin/bash ${username}`;

        if (groups) {
            // -G adds supplementary groups
            cmd += ` -G ${groups}`;
        }

        const createResult = await runCommandOnServer(server.publicIp, server.username, server.privateKey!, cmd, undefined, undefined, true);
        if (createResult.code !== 0) {
            return { error: createResult.stderr || 'Failed to create user' };
        }

        // Set password if provided
        if (password) {
            // echo "user:pass" | chpasswd
            const passCmd = `echo "${username}:${password}" | sudo chpasswd`;
            const passResult = await runCommandOnServer(server.publicIp, server.username, server.privateKey!, passCmd, undefined, undefined, true);
            if (passResult.code !== 0) {
                return { error: 'User created but failed to set password: ' + passResult.stderr };
            }
        }

        return { success: true };
    } catch (e: any) {
        return { error: e.message };
    }
}

export async function deleteUser(serverId: string, username: string) {
    const server = await getServerForRunner(serverId);
    if (!server) return { error: 'Server not found' };

    try {
        // userdel -r removes home directory too
        const cmd = `sudo userdel -r ${username}`;
        const result = await runCommandOnServer(server.publicIp, server.username, server.privateKey!, cmd, undefined, undefined, true);

        if (result.code !== 0) {
            return { error: result.stderr || 'Failed to delete user' };
        }
        return { success: true };
    } catch (e: any) {
        return { error: e.message };
    }
}

export async function getSystemUsers(serverId: string): Promise<{ users?: SystemUser[], error?: string }> {
    const server = await getServerForRunner(serverId);
    if (!server) {
        return { error: 'Server not found.' };
    }
    if (!server.username || !server.privateKey) {
        return { error: 'No username or private key configured for this server.' };
    }

    try {
        // Read /etc/passwd
        const result = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            'cat /etc/passwd',
            undefined,
            undefined,
            true
        );

        if (result.code !== 0) {
            return { error: result.stderr || `Failed to read passwd file. Exit code: ${result.code}` };
        }

        const users: SystemUser[] = [];
        const lines = result.stdout.split('\n');

        lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed) return;

            // format: username:password:uid:gid:gecos:home:shell
            const parts = trimmed.split(':');
            if (parts.length < 7) return;

            const username = parts[0];
            const uidStr = parts[2];
            const gid = parts[3];
            const description = parts[4];
            const home = parts[5];
            const shell = parts[6];
            const uid = parseInt(uidStr, 10);

            let type: 'system' | 'user' | 'root' = 'system';
            if (uid === 0) type = 'root';
            // Debian/Ubuntu/CentOS generally start standard users at 1000
            else if (uid >= 1000 && uid < 65534) type = 'user';

            // Filter out 'nobody' or very high UIDs if we want, but keeping them as system is fine.
            // Keeping as is for now as per previous logic

            users.push({
                username,
                uid: uidStr,
                gid,
                shell,
                home,
                description,
                type
            });
        });

        // Sort: root first, then users, then system
        users.sort((a, b) => {
            const score = (u: SystemUser) => {
                if (u.type === 'root') return 0;
                if (u.type === 'user') return 1;
                return 2;
            };
            return score(a) - score(b) || a.username.localeCompare(b.username);
        });

        return { users };

    } catch (e: any) {
        return { error: `Failed to fetch users: ${e.message}` };
    }
}

export async function getUserDetails(serverId: string, username: string): Promise<{ user?: SystemUser, error?: string }> {
    const { users, error } = await getSystemUsers(serverId);
    if (error || !users) return { error: error || 'Failed to list users' };

    const user = users.find(u => u.username === username);
    if (!user) return { error: 'User not found' };

    // Fetch groups
    const server = await getServerForRunner(serverId);
    if (!server) return { error: 'Server not found' };

    try {
        // command: groups <username>
        // output: username : group1 group2 ...
        const groupsResult = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey!,
            `groups ${username}`,
            undefined,
            undefined,
            true
        );

        if (groupsResult.code === 0) {
            // parse: "username : group1 group2"
            const parts = groupsResult.stdout.trim().split(':');
            if (parts.length > 1) {
                user.groups = parts[1].trim().split(' ');
            } else {
                user.groups = [];
            }
        }
    } catch (e) {
        // Ignore group fetch error, just return user
    }

    return { user };
}

export async function updateUserPassword(serverId: string, username: string, password: string): Promise<{ success?: boolean, error?: string }> {
    const server = await getServerForRunner(serverId);
    if (!server) return { error: 'Server not found' };

    try {
        const passCmd = `echo "${username}:${password}" | sudo chpasswd`;
        const result = await runCommandOnServer(server.publicIp, server.username, server.privateKey!, passCmd, undefined, undefined, true);

        if (result.code !== 0) {
            return { error: result.stderr || 'Failed to update password' };
        }
        return { success: true };
    } catch (e: any) {
        return { error: e.message };
    }
}

export async function toggleSudo(serverId: string, username: string, enable: boolean): Promise<{ success?: boolean, error?: string }> {
    const server = await getServerForRunner(serverId);
    if (!server) return { error: 'Server not found' };

    // Commands depend on distro slightly. 
    // Debian/Ubuntu uses 'sudo' group. Centos/RHEL uses 'wheel'.
    // We can try adding to both or detect.
    // Safest generic approach: try 'usermod -aG sudo' AND 'usermod -aG wheel'.
    // One will fail if group doesn't exist, but that's okay.
    // Or we check which one exists.

    // For simplicity, let's assume Ubuntu/Debian 'sudo' based on the request context often implying standard cloud images.
    // But let's try `sudo` first.

    // Wait, typical usermod usage:
    // grant: sudo usermod -aG sudo <user>
    // revoke: sudo gpasswd -d <user> sudo  (or deluser user group)

    try {
        let cmd = '';
        if (enable) {
            // Try adding to sudo. stderr might complain if group not found, we can suppress or ignore.
            cmd = `sudo usermod -aG sudo ${username} 2>/dev/null || sudo usermod -aG wheel ${username}`;
        } else {
            // Remove from sudo and wheel
            cmd = `sudo gpasswd -d ${username} sudo 2>/dev/null; sudo gpasswd -d ${username} wheel 2>/dev/null; true`;
        }

        const result = await runCommandOnServer(server.publicIp, server.username, server.privateKey!, cmd, undefined, undefined, true);

        // Check code? 'gpasswd' returns 3 if client not member. 'true' ensures we don't strict fail if not in group.

        return { success: true };
    } catch (e: any) {
        return { error: e.message };
    }
}
