'use server';

/*
::neup.documentation::load-more-notifications-action
::title Load More Notifications Action

::public

Loads the next page of notifications for the authenticated account.

::public end

::end
*/

import { getCookie } from '@/core/helpers/cookie';
import logica from '@/logica';
import { getAccountNotifications, NOTIFICATIONS_PAGE_SIZE } from '@/services/notifications/notifications-service';

export async function loadMoreNotifications(offset: number) {
  try {
    const authAccountToken = await getCookie('auth_account');
    if (!authAccountToken) throw new Error('No authenticated account was found.');
    const authentication = await logica.account.auth.verify(authAccountToken);
    const accountId = authentication.valid && typeof authentication.payload.aid === 'string' ? authentication.payload.aid.trim() : '';
    if (!accountId) throw new Error('The authenticated cookie does not contain an account id.');
    const notifications = await getAccountNotifications(accountId, offset, NOTIFICATIONS_PAGE_SIZE);
    return { notifications, hasMore: notifications.length === NOTIFICATIONS_PAGE_SIZE, error: null };
  } catch (error) {
    return { notifications: [], hasMore: false, error: error instanceof Error ? error.message : 'Unable to load notifications.' };
  }
}
