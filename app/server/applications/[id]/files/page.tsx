
import { getApplication } from "../../actions";
import { notFound } from "next/navigation";
import { PageTitleBack } from "@/components/page-header";
import { FilesForm } from "./files-form";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InfoIcon } from "lucide-react";
import { Application } from "../../types";

export default async function ApplicationFilesPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const application = (await getApplication(id)) as Application | null;

    if (!application) {
        notFound();
    }

    return (
        <div className="flex flex-col gap-8 max-w-5xl animate-in fade-in duration-500">
            <PageTitleBack
                title="File Management"
                description={`Manage custom file overrides for ${application.name}`}
                backHref={`/server/applications/${id}`}
            >
                <Badge variant="outline">{application.language}</Badge>
            </PageTitleBack>

            <Alert className="bg-muted/50">
                <InfoIcon className="h-4 w-4" />
                <AlertTitle>Override Warning</AlertTitle>
                <AlertDescription>
                    Files added here will overwrite existing files in your application directory upon the next deployment or configuration update. Use with caution.
                </AlertDescription>
            </Alert>

            <FilesForm application={application} />
        </div>
    );
}
