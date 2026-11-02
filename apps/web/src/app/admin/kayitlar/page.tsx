import { requireAdmin } from "@/lib/auth";
import { call } from "@/lib/db";

export const metadata = { title: "İşlem kayıtları" };
export const dynamic = "force-dynamic";

type Log = { Id: number; Action: string; Entity: string; EntityId: string | null; Details: string | null; CreatedAtLocal: Date; ActorName: string | null };

// Kayıt türlerinin Türkçe karşılıkları (bilinmeyenler olduğu gibi gösterilir)
const ACTIONS: Record<string, string> = {
  user_role: "Kullanıcı rolü değişti", user_active: "Kullanıcı engeli", review_hidden: "Yorum gizleme", report_resolve: "Şikayet kapatıldı",
  certificate_review: "Belge incelendi", settings: "Ayar değişti", service_category: "Kategori kaydedildi", template_save: "Hazır mesaj kaydedildi",
  shop_status: "Dükkân durumu", shop_create: "Dükkân eklendi", shop_delete: "Dükkân silindi", shop_owner: "Dükkân devredildi",
  shop_segment: "Dükkân bölümü değişti", claim_resolve: "Sahiplenme talebi", gallery_hidden: "Galeri fotoğrafı gizlendi",
  gallery_remove: "Galeri fotoğrafı silindi", campaign_send: "Kampanya gönderildi",
};
const when = (d: Date) => new Intl.DateTimeFormat("tr-TR", { timeZone: "UTC", dateStyle: "short", timeStyle: "short" }).format(new Date(d));

export default async function Page() {
  const admin = await requireAdmin();
  const rows = await call<Log>("api.Admin_AuditLog_List", { ActorId: admin.Id, Top: 300 });
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-extrabold">İşlem kayıtları</h1>
      <p className="text-sm text-muted">Admin ve sistem işlemlerinin son 300 kaydı. Kim, ne zaman, neyi değiştirdi.</p>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-surface-2 text-left"><tr><th className="p-3">Zaman</th><th className="p-3">Kim</th><th className="p-3">İşlem</th><th className="p-3">Ayrıntı</th></tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.Id}>
                <td className="whitespace-nowrap p-3 text-muted">{when(r.CreatedAtLocal)}</td>
                <td className="p-3">{r.ActorName ?? "Sistem"}</td>
                <td className="p-3 font-medium">{ACTIONS[r.Action] ?? r.Action}</td>
                <td className="max-w-md truncate p-3 font-mono text-xs text-muted" title={r.Details ?? ""}>{r.Details ?? r.EntityId ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
