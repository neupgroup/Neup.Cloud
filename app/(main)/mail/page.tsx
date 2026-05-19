import React from 'react';
import MailConfigEditor from '@/components/mail/MailConfigEditor';

export default function MailPage() {
  return (
    <React.Suspense fallback={null}>
      <MailConfigEditor />
    </React.Suspense>
  );
}
