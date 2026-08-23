/*
::neup.documentation::notifications-service
::title Notifications Service

::public

Loads a page of account notifications from the Neup notification bridge.

::public end

::end
*/

import logica from '@/logica';
import type { NotificationRecord } from '@/logica/notification';

export const NOTIFICATIONS_PAGE_SIZE = 20;

export async function getAccountNotifications(accountId: string, offset = 0, limit = NOTIFICATIONS_PAGE_SIZE): Promise<NotificationRecord[]> {
  const response = await logica.notification({ application: process.env.NEUP_APP_ID, appsecret: process.env.NEUP_APP_SECRET })
    .wildcard({ accountId, limit, offset }).get();
  if (!response.ok) throw new Error(`Notifications request failed with status ${response.status}.`);
  if (!response.body?.success) throw new Error(response.body?.error_description || response.body?.error || 'Unable to load notifications.');
  return response.body.data;
}
