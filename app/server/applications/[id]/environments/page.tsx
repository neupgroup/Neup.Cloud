
import { getApplication } from "../../actions";
import { notFound } from "next/navigation";
import { PageTitleBack } from "@/components/page-header";
import { EnvironmentsForm } from "./environments-form";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InfoIcon, Lock } from "lucide-react";

export default async function ApplicationEnvironmentsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const application = await getApplication(id);

    if (!application) {
        notFound();
    }

    return (
        <div className="flex flex-col gap-8 max-w-5xl animate-in fade-in duration-500">
            <PageTitleBack
                title="Environments"
                description={`Manage environment variables for ${application.name}`}
                backHref={`/server/applications/${id}`}
            >
                <Badge variant="outline">{application.language}</Badge>
            </PageTitleBack>

            <Alert>
                <Lock className="h-4 w-4" />
                <AlertTitle>Security Note</AlertTitle>
                <AlertDescription>
                    Environment variables are stored securely in the database and written to the server only when you deploy.
                    Ensure you do not commit sensitive keys to your repository.
                </AlertDescription>
            </Alert>

            <EnvironmentsForm application={application} />

            <Alert className="bg-muted/50">
                <InfoIcon className="h-4 w-4" />
                <AlertTitle>Deployment Required</AlertTitle>
                <AlertDescription>
                    After saving variables, use the "Deploy Config" button on the application dashboard
                    to apply them to your running instance.
                </AlertDescription>
            </Alert>
        </div>
    );
}
