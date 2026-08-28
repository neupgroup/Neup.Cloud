import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { KeyRound } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert';
import { getApplication } from '@/services/server/applications/service';
import { PageTitleBack } from '@/components/page-header';
import { EnvironmentsForm } from '../environments-form';
import { withSelectedServerQuery } from '@/helpers/navigation';

export const metadata: Metadata = { title: 'Environments, Neup.Cloud' };

export default async function ApplicationEnvironmentsPage({
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
        title="Environments"
        description={`Environment variables for ${application.name}`}
        backHref={withSelectedServerQuery(`/server/applications/${id}`, resolvedSearchParams.selectedServer)}
      />
      <Alert>
        <KeyRound className="h-4 w-4" />
        <AlertTitle>Security Note</AlertTitle>
        <AlertDescription>
          Environment variables are stored securely and written to the server only when you deploy.
          Do not commit sensitive keys to your repository.
        </AlertDescription>
      </Alert>
      <EnvironmentsForm application={application} />
      <Alert className="bg-muted/50">
        <AlertTitle>Deployment Required</AlertTitle>
        <AlertDescription>
          After saving, use "Deploy Configuration" on the application dashboard to apply changes.
        </AlertDescription>
      </Alert>
    </div>
  );
}
