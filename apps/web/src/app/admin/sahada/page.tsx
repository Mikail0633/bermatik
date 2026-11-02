import { requireAdmin } from "@/lib/auth";
import { QuickAdd } from "./QuickAdd";

export const metadata = { title: "Sahada ekle" };

// Telefondan, dükkânın önündeyken: "Buradayım" → ad → kaydet
export default async function Page() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-extrabold">Sahada dükkân ekle</h1>
      <p className="text-sm text-muted">Dükkânın önündeyken telefondan kullanın. Konum telefondan alınır, adres kendiliğinden bulunur; siz yalnızca adını (ve varsa telefonunu) yazın.</p>
      <div className="mt-4"><QuickAdd /></div>
    </div>
  );
}
