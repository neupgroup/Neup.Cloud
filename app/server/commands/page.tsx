import { Metadata } from "next";
import ClientPage from "./client-page";

export const metadata: Metadata = {
    title: "Commands, Neup.Cloud",
};

export default function Page() {
    return <ClientPage />;
}
