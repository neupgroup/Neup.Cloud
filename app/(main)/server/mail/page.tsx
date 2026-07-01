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

export default function ServerMailPage() {
  return (
    <React.Suspense fallback={null}>
      <MailConfigEditor backHref="/server/home" />
    </React.Suspense>
  );
}
