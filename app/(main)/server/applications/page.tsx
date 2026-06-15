import { Metadata } from "next";

import { ApplicationsPage } from "@/components/applications/list-page";

export const metadata: Metadata = {
    title: "Applications, Neup.Cloud",
};

export default async function Page({
    searchParams,
}: {
    searchParams?: Promise<{ selectedServer?: string }>;
}) {
    const resolvedSearchParams = searchParams ? await searchParams : {};
    const selectedServerId = resolvedSearchParams.selectedServer?.trim() || null;

    return <ApplicationsPage selectedServerId={selectedServerId} />;
}
 
