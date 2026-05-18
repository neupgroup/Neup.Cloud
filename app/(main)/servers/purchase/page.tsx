import { redirect } from "next/navigation";

export default function ServersPurchaseRedirectPage() {
  redirect("/server/list/purchase");
}