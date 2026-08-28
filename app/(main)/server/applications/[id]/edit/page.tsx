import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getApplication } from '@/services/server/applications/service';
import { PageTitleBack } from '@/components/page-header';
import { Badge } from '#/components/ui/badge';
import EditApplicationForm from '../edit-form';

export const metadata: Metadata = { title: 'Edit Application, Neup.Cloud' };

export default async function ApplicationEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const application = await getApplication(id);
  if (!application) notFound();

  return (
    <div className="flex flex-col gap-8 max-w-3xl animate-in fade-in duration-500">
      <PageTitleBack
        title={`Edit ${application.name}`}
        description="Update application configuration"
        backHref={`/server/applications/${id}`}
      >
        <Badge variant="outline">{application.language}</Badge>
      </PageTitleBack>
      <EditApplicationForm application={application} />
    </div>
  );
}
