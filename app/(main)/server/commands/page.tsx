import { Suspense } from 'react';
import { CommandsContent } from './commands-content';

export default function CommandsPage() {
  return (
    <Suspense fallback={null}>
      <CommandsContent mode="dashboard" />
    </Suspense>
  );
}
