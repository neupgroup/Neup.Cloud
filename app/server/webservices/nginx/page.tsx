import { Metadata } from "next";
import ClientPage from "./client-page";

export const metadata: Metadata = {
    title: "Nginx Configurations, Neup.Cloud",
};

export default function Page() {
    return <ClientPage />;
}
