import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { FileText } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert';
import { getApplication } from '@/services/server/applications/service';
import { PageTitleBack } from '@/components/page-header';
import { FilesForm } from '../files-form';
import { withSelectedServerQuery } from '@/helpers/navigation';

export const metadata: Metadata = { title: 'Files, Neup.Cloud' };

export default async function ApplicationFilesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ selectedServer?: string }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const application = await getApplication(id);
  if (!application) notFound();

  return (
    <div className="flex flex-col gap-8 max-w-3xl animate-in fade-in duration-500">
      <PageTitleBack
        title="File Management"
        description={`Custom file overrides for ${application.name}`}
        backHref={withSelectedServerQuery(`/server/applications/${id}`, resolvedSearchParams.selectedServer)}
      />
      <Alert className="bg-muted/50">
        <FileText className="h-4 w-4" />
        <AlertTitle>Override Warning</AlertTitle>
        <AlertDescription>
          Files added here will overwrite existing files in your application directory upon the next deployment. Use with caution.
        </AlertDescription>
      </Alert>
      <FilesForm application={application} />
    </div>
  );
}
