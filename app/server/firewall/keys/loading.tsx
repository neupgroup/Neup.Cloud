import { PageTitle } from "@/components/page-header";
import { Key } from "lucide-react";
import KeysList from "./keys-list";

export default function Loading() {
    return (
        <div className="space-y-6">
            <PageTitle
                title={
                    <span className="flex items-center gap-2">
                        <Key className="h-6 w-6 text-primary" />
                        SSH Keys
                    </span>
                }
                description="Manage SSH keys for secure access to your instance."
            />
            <KeysList serverId={undefined} isLoadingOverride={true} />
        </div>
    );
}
