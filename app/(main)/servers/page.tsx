import { redirect } from "next/navigation";

export default function ServersRedirectPage() {
  redirect("/server/list");
}