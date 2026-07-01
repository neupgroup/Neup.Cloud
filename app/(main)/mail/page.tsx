/*
::neup.documentation::mail-page

Account-level mail page entrypoint.

::private

Renders the shared mail configuration flow for the global navigation route.

::private end
::end
*/

import React from 'react';
import MailConfigEditor from '@/components/mail/MailConfigEditor';

export default function MailPage() {
  return (
    <React.Suspense fallback={null}>
      <MailConfigEditor backHref="/server/list" />
    </React.Suspense>
  );
}
