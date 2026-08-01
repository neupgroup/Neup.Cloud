'use client';

/*
::neup.documentation::inapp-hooks-use-server-name
::title Server Name Hook

Resolves the selected server name for client views.

::public

Use `useServerName()` when UI should display the currently selected server name.

::public end

::private

The hook caches server names in session storage to avoid repeated client-side lookups while the selected server remains stable.

::private end

::end
*/

import { useEffect, useState } from 'react';

import { getServer } from '@/services/server/server-service';
import { useSelectedServerId } from '@/inapp/hooks/use-selected-server';

export function useServerName() {
  const [serverName, setServerName] = useState<string | null>(null);
  const selectedServerId = useSelectedServerId();

  useEffect(() => {
    const fetchName = async () => {
      if (!selectedServerId) {
        setServerName(null);
        return;
      }

      const cached = sessionStorage.getItem(`server_name_${selectedServerId}`);
      if (cached) {
        setServerName(cached);
        return;
      }

      try {
        const server = await getServer(selectedServerId);
        if (server?.name) {
          setServerName(server.name);
          sessionStorage.setItem(`server_name_${selectedServerId}`, server.name);
        }
      } catch (error) {
        console.error('Failed to fetch server name for cache:', error);
      }
    };

    fetchName();
  }, [selectedServerId]);

  return serverName;
}
