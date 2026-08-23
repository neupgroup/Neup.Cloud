import { Suspense } from 'react';
import type { Metadata } from 'next';
import { CommandsContent } from '../commands-content';

export const metadata: Metadata = {
  title: 'Command History, Neup.Cloud',
};

export default function CommandHistoryPage() {
  return (
    <Suspense fallback={null}>
      <CommandsContent mode="history" />
    </Suspense>
  );
}
