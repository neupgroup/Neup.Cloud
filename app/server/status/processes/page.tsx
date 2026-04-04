import { redirect } from "next/navigation";

export default function StatusProcessesRedirectPage() {
  redirect("/server/status");
}
