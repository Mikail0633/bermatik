import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Eski seçim sayfası: artık herkes doğrudan kendi bölümüne gider
export default async function Page() {
  const user = await requireUser("/");
  if (user.Role === "admin") redirect("/admin");
  if (user.Role === "shop_owner" || user.Role === "staff") redirect("/panel");
  redirect("/");
}
