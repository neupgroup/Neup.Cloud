import { cookies } from "next/headers";
import { InstallPackagesClient } from "./install-packages-client";
import { PageTitle } from "@/components/page-header";
import { Package } from "lucide-react";

export default async function PackagesInstallPage() {
    const cookieStore = await cookies();
    const serverId = cookieStore.get('selected_server')?.value;
    const serverName = cookieStore.get('selected_server_name')?.value || 'Server';

    return (
        <div className="animate-in fade-in duration-500 pb-10">
            {serverId ? (
                <InstallPackagesClient serverId={serverId} serverName={serverName} />
            ) : (
                <div className="p-8 text-center border rounded-lg bg-muted/10 border-dashed">
                    <h3 className="text-lg font-medium">No Server Selected</h3>
                    <p className="text-muted-foreground mt-2">Please select a server to manage packages.</p>
                </div>
            )}
        </div>
    );
}
