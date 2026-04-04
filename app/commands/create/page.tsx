import { Suspense } from 'react';
import { Metadata } from "next";
import ClientPage from "./client-page";

export const metadata: Metadata = {
    title: "Create Commands, Neup.Cloud",
};

export default function Page() {
    return (
        <Suspense fallback={null}>
            <ClientPage />
        </Suspense>
    );
}
