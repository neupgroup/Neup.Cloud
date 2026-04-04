import { Suspense } from 'react';
import type { Metadata } from 'next';
import { CommandsContent } from '../client-page';

export const metadata: Metadata = {
  title: 'Saved Commands, Neup.Cloud',
};

export default function SavedCommandsPage() {
  return (
    <Suspense fallback={null}>
      <CommandsContent mode="saved" />
    </Suspense>
  );
}
