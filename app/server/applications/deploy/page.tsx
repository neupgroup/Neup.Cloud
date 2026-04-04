import { Metadata } from "next";
import ClientPage from "./client-page";

export const metadata: Metadata = {
    title: "Deploy Application, Neup.Cloud",
};

export default function Page() {
    return <ClientPage />;
}
