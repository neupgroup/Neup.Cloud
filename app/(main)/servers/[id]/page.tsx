import { redirect } from "next/navigation";

export default function ServersIdRedirectPage({ params }: { params: { id: string } }) {
  redirect(`/server/list/${params.id}`);
}