import { PageTitle } from "@/components/page-header";
import { Users } from "lucide-react";
import UsersList from "./users-list";

export default function Loading() {
    return (
        <div className="space-y-6">
            <PageTitle
                title={
                    <span className="flex items-center gap-2">
                        <Users className="h-6 w-6 text-primary" />
                        Instance Users
                    </span>
                }
                description="Manage system accounts and user access for this instance."
            />
            <UsersList users={[]} isLoading={true} />
        </div>
    );
}
