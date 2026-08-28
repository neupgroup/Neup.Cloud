import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { KeyRound } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/component/ui/alert';
import { getApplication } from '@/services/server/applications/service';
import { PageTitleBack } from '@/components/page-header';
import { EnvironmentsForm } from '../environments-form';

export const metadata: Metadata = { title: 'Environments, Neup.Cloud' };

export default async function ApplicationEnvironmentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const application = await getApplication(id);
  if (!application) notFound();

  return (
    <div className="flex flex-col gap-8 max-w-3xl animate-in fade-in duration-500">
      <PageTitleBack
        title="Environments"
        description={`Environment variables for ${application.name}`}
        backHref={`/server/applications/${id}`}
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
