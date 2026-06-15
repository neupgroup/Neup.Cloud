'use client';

import { useState, useEffect } from 'react';
import { getServer } from '@/services/server/server-service';
import { useSelectedServerId } from '@/core/hooks/use-selected-server';

export function useServerName() {
    const [serverName, setServerName] = useState<string | null>(null);
    const selectedServerId = useSelectedServerId();

    useEffect(() => {
        const fetchName = async () => {
            if (!selectedServerId) {
                setServerName(null);
                return;
            }

            // 1. Try Session Storage for instant hit
            const cached = sessionStorage.getItem(`server_name_${selectedServerId}`);
            if (cached) {
                setServerName(cached);
                return;
            }

            // 3. Fallback: Fetch once from the server and cache
            try {
                const server = await getServer(selectedServerId);
                if (server?.name) {
                    setServerName(server.name);
                    sessionStorage.setItem(`server_name_${selectedServerId}`, server.name);
                }
            } catch (error) {
                console.error("Failed to fetch server name for cache:", error);
            }
        };

        fetchName();
    }, [selectedServerId]);

    return serverName;
}
