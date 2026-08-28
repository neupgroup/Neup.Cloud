'use client';

import { Edit } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '#/components/ui/button';
import { DeleteApplicationButton } from '@/components/delete-application-button';

export function ApplicationActions({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  return (
    <div className="flex items-center flex-wrap gap-3 pt-4">
      <Button variant="outline" className="gap-2" onClick={() => router.push(`/server/applications/${applicationId}/edit`)}>
        <Edit className="h-4 w-4" />
        Edit
      </Button>
      <DeleteApplicationButton applicationId={applicationId} />
    </div>
  );
}
