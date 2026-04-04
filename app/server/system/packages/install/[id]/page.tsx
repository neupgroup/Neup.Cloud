import { cookies } from "next/headers";
import { InstallPackageDetailsClient } from "./install-package-details-client";
import { notFound } from "next/navigation";

type Props = {
    params: Promise<{ id: string }>
}

export default async function InstallPackageDetailsPage({ params }: Props) {
    const { id } = await params;
    const cookieStore = await cookies();
    const serverId = cookieStore.get('selected_server')?.value;
    const serverName = cookieStore.get('selected_server_name')?.value || 'Server';

    if (!serverId) {
        return (
            <div className="p-8 text-center border rounded-lg bg-muted/10 border-dashed">
                <h3 className="text-lg font-medium">No Server Selected</h3>
                <p className="text-muted-foreground mt-2">Please select a server to manage packages.</p>
            </div>
        )
    }

    return (
        <div className="animate-in fade-in duration-500 pb-10">
            <InstallPackageDetailsClient serverId={serverId} serverName={serverName} packageName={id} />
        </div>
    );
}
