import { redirect } from "next/navigation";

export default function ServersAddRedirectPage() {
  redirect("/server/list/add");
}