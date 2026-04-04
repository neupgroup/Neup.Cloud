import { Metadata } from "next";
import ClientPage from "./client-page";

export const metadata: Metadata = {
    title: "System, Neup.Cloud",
};

export default function Page() {
    return <ClientPage />;
}
