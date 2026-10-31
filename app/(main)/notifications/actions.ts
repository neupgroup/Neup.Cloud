'use server';

/*
::neup.documentation::load-more-notifications-action
::title Load More Notifications Action

::public

Loads the next page of notifications for the authenticated account.

::public end

::end
*/

import { getAccountNotifications, NOTIFICATIONS_PAGE_SIZE } from '@/services/notifications/notifications-service';
import { authenticateCurrentCookie } from '@/services/auth/authentication';

export async function loadMoreNotifications(offset: number) {
  try {
    const authentication = await authenticateCurrentCookie();
    if (!authentication) throw new Error('No authenticated account was found.');
    const accountId = authentication.accountId;
    const notifications = await getAccountNotifications(accountId, offset, NOTIFICATIONS_PAGE_SIZE);
    return { notifications, hasMore: notifications.length === NOTIFICATIONS_PAGE_SIZE, error: null };
  } catch (error) {
    return { notifications: [], hasMore: false, error: error instanceof Error ? error.message : 'Unable to load notifications.' };
  }
}
