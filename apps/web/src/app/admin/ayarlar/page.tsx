import { requireAdmin } from "@/lib/auth";
import { call, callOne } from "@/lib/db";
import { ActionButton } from "@/components/ActionButton";
import { setPlatformSetting } from "../actions";
import { CategoryForm, TemplateForm } from "./forms";

export const metadata = { title: "Ayarlar ve metinler" };
export const dynamic = "force-dynamic";

type Settings = { ReviewsEnabled: boolean; StoreEnabled: boolean; ServiceDescriptionsEnabled: boolean; CommercialConsentEnabled: boolean };
export type Category = {
  Id: number; Segment: "erkek" | "kadin"; Slug: string; Name: string; Description: string | null; SortOrder: number;
  IsActive: boolean; RevisitDays: number | null; UsageCount: number;
};
export type Template = { Id: number; Title: string; Body: string; IsActive: boolean; Segment: "erkek" | "kadin" | null };

const SWITCHES: { key: keyof Settings; title: string; text: string }[] = [
  { key: "ReviewsEnabled", title: "Müşteri yorumları", text: "Kapalıyken yorum yazılamaz ve puanlar gösterilmez." },
  { key: "ServiceDescriptionsEnabled", title: "Hizmet açıklamaları", text: "Fiyat listesinde hizmetin altında kısa açıklama çıkar." },
  { key: "StoreEnabled", title: "Ürün satışı (mağaza)", text: "Dükkânlar ürün satabilir. Henüz ekranı yok; şimdilik kapalı tutun." },
  { key: "CommercialConsentEnabled", title: "Kampanya izni (İYS)", text: "Kayıtta ve Hesabım'da \"kampanya e-posta/SMS almak istiyorum\" kutusu çıkar. Bermatik İYS'ye (iys.org.tr) kaydolmadan açmayın." },
];

export default async function Page() {
  const admin = await requireAdmin();
  const [settings, categories, templates] = await Promise.all([
    callOne<Settings>("api.Settings_Get"),
    call<Category>("api.Admin_ServiceCategory_List", { ActorId: admin.Id }),
    call<Template>("api.Template_List", { ActorId: admin.Id }),
  ]);
  const box = "rounded-2xl border border-line bg-surface p-5";
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <section>
        <h1 className="text-2xl font-extrabold">Ayarlar</h1>
        <div className={`${box} mt-3 divide-y divide-line p-0`}>
          {SWITCHES.map((s) => {
            const on = Boolean(settings?.[s.key]);
            return (
              <div key={s.key} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold">{s.title} <span className={`ml-1 rounded px-1.5 py-0.5 text-xs font-bold ${on ? "bg-open/15 text-open" : "bg-surface-2 text-muted"}`}>{on ? "AÇIK" : "KAPALI"}</span></p>
                  <p className="text-sm text-muted">{s.text}</p>
                </div>
                <ActionButton variant={on ? "danger" : "success"} action={setPlatformSetting.bind(null, s.key, !on)}>{on ? "Kapat" : "Aç"}</ActionButton>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-extrabold">Hizmet kategorileri</h2>
        <p className="text-sm text-muted">
          Dükkânlar hizmetlerini bu kategorilere göre ekler. <b>Tekrar gelme günü</b> doluysa müşteriye o kadar gün sonra
          &quot;tekrar randevu alma zamanı&quot; hatırlatması gider (ör. saç kesimi 30 gün).
        </p>
        {(["erkek", "kadin"] as const).map((seg) => (
          <div key={seg} className={`${box} mt-3`}>
            <h3 className="mb-2 font-bold">{seg === "erkek" ? "Erkek berberi" : "Kadın kuaförü"}</h3>
            <ul className="divide-y divide-line">
              {categories.filter((c) => c.Segment === seg).map((c) => (
                <li key={c.Id} className={`py-2 ${c.IsActive ? "" : "opacity-60"}`}>
                  <details>
                    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                      <span><b>{c.Name}</b> <span className="text-sm text-muted">· {c.UsageCount} dükkânda{c.RevisitDays ? ` · ${c.RevisitDays} günde bir` : ""}{!c.IsActive && " · pasif"}</span></span>
                      <span className="text-sm underline">Düzenle</span>
                    </summary>
                    <div className="mt-2 rounded-xl bg-surface-2 p-3"><CategoryForm segment={seg} initial={c} /></div>
                  </details>
                </li>
              ))}
            </ul>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold text-accent">+ Yeni kategori</summary>
              <div className="mt-2 rounded-xl bg-surface-2 p-3"><CategoryForm segment={seg} /></div>
            </details>
          </div>
        ))}
      </section>

      <section>
        <h2 className="text-2xl font-extrabold">Hazır mesajlar</h2>
        <p className="text-sm text-muted">Dükkânların müşteriye tek tıkla gönderebildiği kısa mesajlar (ör. &quot;5 dakika gecikeceğim&quot;).</p>
        <div className={`${box} mt-3`}>
          <ul className="divide-y divide-line">
            {templates.map((t) => (
              <li key={t.Id} className={`py-2 ${t.IsActive ? "" : "opacity-60"}`}>
                <details>
                  <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                    <span><b>{t.Title}</b> <span className="rounded bg-surface-2 px-1.5 text-xs">{t.Segment === "erkek" ? "Erkek" : t.Segment === "kadin" ? "Kadın" : "İkisi"}</span> <span className="text-sm text-muted">· {t.Body}</span></span>
                    <span className="text-sm underline">Düzenle</span>
                  </summary>
                  <div className="mt-2 rounded-xl bg-surface-2 p-3"><TemplateForm initial={t} /></div>
                </details>
              </li>
            ))}
          </ul>
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-semibold text-accent">+ Yeni mesaj</summary>
            <div className="mt-2 rounded-xl bg-surface-2 p-3"><TemplateForm /></div>
          </details>
        </div>
      </section>
    </div>
  );
}
