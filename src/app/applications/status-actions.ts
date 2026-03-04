
'use server';

import { executeQuickCommand } from '../commands/actions';
import { getApplication, getProcessDetails, getSupervisorProcesses } from './actions';
import { cookies } from 'next/headers';
import { sanitizeAppName } from '@/core/universal';

export type AppStatusResult = {
    processStatus: 'running' | 'stopped' | 'error' | 'unknown';
    availability: 'active' | 'inactive' | 'checking' | 'unknown';
    uptime: string;
    metrics: {
        memory?: string;
        cpu?: string;
    };
    lastChecked: string;
    details?: string;
};

export async function checkApplicationStatus(applicationId: string): Promise<AppStatusResult> {
    const app = await getApplication(applicationId) as any;
    if (!app) {
        return { processStatus: 'unknown', availability: 'unknown', uptime: 'N/A', metrics: {}, lastChecked: new Date().toISOString() };
    }

    const cookieStore = await cookies();
    const serverId = cookieStore.get('selected_server')?.value;

    if (!serverId) {
        return { processStatus: 'unknown', availability: 'unknown', uptime: 'N/A', metrics: {}, lastChecked: new Date().toISOString(), details: 'No server selected' };
    }

    // Step 1: Check Process via PM2
    // We use pm2 jlist to get detailed JSON info
    const pm2Command = `pm2 jlist`;
    const pm2Result = await executeQuickCommand(serverId, pm2Command);

    let processStatus: AppStatusResult['processStatus'] = 'unknown';
    let uptime = 'N/A';
    let memory = undefined;
    let cpu = undefined;

    if (pm2Result.exitCode === 0) {
        try {
            const processes = JSON.parse(pm2Result.output);
            const sanitizedName = sanitizeAppName(app.name);
            const appProcess = processes.find((p: any) => p.name === sanitizedName);

            if (appProcess) {
                if (appProcess.pm2_env.status === 'online') {
                    processStatus = 'running';
                    // Calculate uptime
                    const uptimeMs = Date.now() - appProcess.pm2_env.pm_uptime;
                    const uptimeSeconds = Math.floor(uptimeMs / 1000);
                    const hours = Math.floor(uptimeSeconds / 3600);
                    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
                    uptime = `${hours}h ${minutes}m`;

                    // Metrics
                    if (appProcess.monit) {
                        memory = `${(appProcess.monit.memory / 1024 / 1024).toFixed(1)} MB`;
                        cpu = `${appProcess.monit.cpu}%`;
                    }
                } else {
                    processStatus = 'stopped';
                    uptime = '0m';
                }
            } else {
                // Not found in PM2, try Supervisor
                processStatus = 'unknown'; 
            }
        } catch (e) {
            console.error("Failed to parse PM2 output:", e);
            // Fallback to try supervisor if PM2 fails
            processStatus = 'unknown';
        }
    }

    // Step 1.5: Check Process via Supervisor (if not found in PM2)
    if (processStatus === 'unknown' || processStatus === 'stopped') {
        try {
            // Ensure app name is sterilized and truncated according to system provisions
            // System Limit: 16 characters max, lowercase, no special chars, spaces to underscores
            const sanitizedName = sanitizeAppName(app.name);
            
            let supervisorProcess = await getProcessDetails('supervisor', sanitizedName);

            // Fallback: If direct check failed, try listing all processes
            // This handles cases where the process might be in a group or direct name lookup failed
            if (!supervisorProcess) {
                const allProcesses = await getSupervisorProcesses();
                if (Array.isArray(allProcesses)) {
                    const found = allProcesses.find((p: any) => 
                        p.name === sanitizedName || 
                        p.name.endsWith(`:${sanitizedName}`) ||
                        // Double check: if the name in supervisor is slightly different but derived from same base?
                        // But strictly, it should match sanitizedName.
                        p.name === sanitizedName.toLowerCase()
                    );
                    
                    if (found) {
                        let pmStatus = 'stopped';
                        if (found.state === 'RUNNING') pmStatus = 'online';
                        else if (found.state === 'FATAL' || found.state === 'BACKOFF') pmStatus = 'errored';
                        else if (found.state === 'STARTING') pmStatus = 'launching';
                        else if (found.state === 'STOPPED' || found.state === 'EXITED') pmStatus = 'stopped';

                        supervisorProcess = {
                            name: found.name,
                            pm_id: found.name,
                            pm2_env: {
                                status: pmStatus,
                                pm_uptime: 0, 
                                _custom_uptime: found.uptime, // Use parsed uptime from supervisorctl
                            },
                            monit: {
                                cpu: 0,
                                memory: 0
                            }
                        } as any;
                    }
                }
            }

            if (supervisorProcess) {
                if (supervisorProcess.pm2_env.status === 'online') {
                    processStatus = 'running';
                    
                    // Calculate uptime
                    if (supervisorProcess.pm2_env._custom_uptime) {
                        uptime = supervisorProcess.pm2_env._custom_uptime;
                    } else if (supervisorProcess.pm2_env.pm_uptime > 0) {
                        const uptimeMs = Date.now() - supervisorProcess.pm2_env.pm_uptime;
                        const uptimeSeconds = Math.floor(uptimeMs / 1000);
                        const hours = Math.floor(uptimeSeconds / 3600);
                        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
                        uptime = `${hours}h ${minutes}m`;
                    } else {
                        uptime = 'Running';
                    }

                    // Metrics
                    if (supervisorProcess.monit) {
                        const memBytes = typeof supervisorProcess.monit.memory === 'number' ? supervisorProcess.monit.memory : 0;
                        memory = `${(memBytes / 1024 / 1024).toFixed(1)} MB`;
                        cpu = `${supervisorProcess.monit.cpu}%`;
                    }
                } else {
                     if (supervisorProcess.pm2_env.status === 'errored') processStatus = 'error';
                     else processStatus = 'stopped';
                     
                     // Even if stopped, we might have uptime info (e.g. "0:00")
                     if (supervisorProcess.pm2_env._custom_uptime) {
                         // usually 0 if stopped, but keep it if present
                     }
                }
            }
        } catch (e) {
            console.warn("Failed to check supervisor status:", e);
        }
    }

    // Step 2: Check Availability
    // Run if process is running OR unknown (fallback to see if port is listening)
    let availability: AppStatusResult['availability'] = 'unknown';

    if (processStatus === 'running' || processStatus === 'unknown') {
        // If app has network access (ports), try to curl the first port
        // Default check strategy: HTTP GET on localhost:<port>
        const uniquePorts = app.networkAccess?.map(Number).filter((p: number) => !isNaN(p) && p > 0) || [];

        if (uniquePorts.length > 0) {
            const port = uniquePorts[0];
            // Simple curl check - returns HTTP status code
            // -s silent, -o dev/null (ignore body), -w display http code
            // 5 second timeout
            const curlCmd = `curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:${port}`;

            const curlResult = await executeQuickCommand(serverId, curlCmd);

            if (curlResult.exitCode === 0) {
                const httpCode = parseInt(curlResult.output.trim());
                if (!isNaN(httpCode) && httpCode >= 200 && httpCode < 400) {
                    availability = 'active';
                } else {
                    availability = 'inactive'; // returned 404, 500, etc.
                }
            } else {
                availability = 'inactive'; // curl failed (connection refused)
            }
        } else {
            // If no ports, we assume "Active" if process is running since we can't probe it easily without config
            // Or strictly: 'unknown'
            availability = 'unknown';
        }
    } else {
        availability = 'inactive';
    }

    return {
        processStatus,
        availability,
        uptime,
        metrics: { memory, cpu },
        lastChecked: new Date().toISOString()
    };
}
