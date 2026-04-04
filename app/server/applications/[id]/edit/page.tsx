
import { getApplication } from '@/app/server/applications/actions';
import { notFound } from 'next/navigation';
import EditApplicationForm from './edit-form';

export default async function EditApplicationPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const application = await getApplication(id);

    if (!application) {
        notFound();
    }

    return <EditApplicationForm application={application} />;
}
