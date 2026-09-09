import { Plus } from 'lucide-react';
import { PageTitle } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card';
import NewProjectForm from './new-project-form';

export default function NewLoggerProjectPage() {
  return <div className="grid gap-8">
    <PageTitle title={<span className="flex items-center gap-3"><Plus className="h-8 w-8 text-primary" />New logger project</span>} description="Create credentials and validation rules for an application that sends logs." />
    <Card className="max-w-3xl"><CardHeader><CardTitle>Project configuration</CardTitle><CardDescription>The ingest key is sent by Logica when reporting activity and errors.</CardDescription></CardHeader><CardContent><NewProjectForm /></CardContent></Card>
  </div>;
}
