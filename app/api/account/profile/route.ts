import { NextResponse } from 'next/server';
import { ensureAccountProfile, getCurrentAccountId } from '@/services/account-profile';

/*
::neup.documentation::account-profile-api
::title Current Account Profile API

::public

Returns the authenticated account's current profile fields for client-side
profile-bar refreshes.

::public end

::private

The account identity is derived from the signed `auth_account` cookie by the
account profile service. The route never accepts an account id from the client.

::private end

::end
*/

export async function GET() {
  const accountId = await getCurrentAccountId();
  if (!accountId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const profile = await ensureAccountProfile({ accountId, forceRefresh: true });
    return NextResponse.json({
      displayName: profile.displayName,
      displayImage: profile.displayImage,
      neupid: profile.neupid?.startsWith('@') ? profile.neupid : profile.neupid ? `@${profile.neupid}` : null,
    });
  } catch (error) {
    console.error('[account profile api] failed to load profile:', error);
    return NextResponse.json({ error: 'Unable to load account profile' }, { status: 500 });
  }
}
