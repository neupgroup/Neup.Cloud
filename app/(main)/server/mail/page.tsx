/*
::neup.documentation::server-mail-page

Server-scoped mail configuration page.

::private

This route reuses the shared mail editor but keeps navigation inside the server section.

::private end
::end
*/

import React from 'react';
import MailConfigEditor from '@/components/mail/MailConfigEditor';
import { withSelectedServerQuery } from '@/helpers/navigation';

export default async function ServerMailPage({
  searchParams,
}: {
  searchParams?: Promise<{ selectedServer?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};

  return (
    <React.Suspense fallback={null}>
      <MailConfigEditor backHref={withSelectedServerQuery('/server/home', resolvedSearchParams.selectedServer)} />
    </React.Suspense>
  );
}
