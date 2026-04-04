import { redirect } from "next/navigation";

export default function StatusNetworkRedirectPage() {
  redirect("/server/firewall/network");
}
