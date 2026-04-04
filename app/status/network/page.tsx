import { redirect } from "next/navigation";

export default function StatusNetworkRedirectPage() {
  redirect("/firewall/network");
}
