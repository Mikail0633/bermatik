"use client";

import { useEffect, useState, useTransition } from "react";
import { Send } from "lucide-react";
import { previewShopCampaign, sendShopCampaign } from "@/app/panel/actions";

type Template = { Id: number; Title: string; Body: string };

export function MessageForm({ shopId, shopName, templates }: { shopId: string; shopName: string; templates: Template[] }) {
  const [templateId, setTemplateId] = useState<number | null>(templates[0]?.Id ?? null);
  const [onlyDue, setOnlyDue] = useState(true);
  const [count, setCount] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>();
  const [pending, start] = useTransition();

  // Seçim değişince "kaç kişiye gidecek" yeniden hesaplanır
  useEffect(() => {
    let live = true;
    setCount(null);
    previewShopCampaign(shopId, onlyDue).then((r) => { if (live) setCount(r.count ?? 0); });
    return () => { live = false; };
  }, [shopId, onlyDue]);

  if (templates.length === 0) return <p className="text-sm text-muted">Şu an hazır mesaj yok.</p>;
  const t = templates.find((x) => x.Id === templateId);
  const fill = (s: string) => s.replaceAll("{ad}", "Ayşe").replaceAll("{dukkan}", shopName);

  const send = () => {
    if (!templateId || !count) return;
    if (!confirm(`Bu mesaj ${count} müşterinize gönderilsin mi?`)) return;
    start(async () => setMsg(await sendShopCampaign(shopId, templateId, onlyDue)));
  };

  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-semibold">Hazır mesaj seçin</legend>
        {templates.map((x) => (
          <label key={x.Id} className={`flex cursor-pointer gap-3 rounded-xl border p-3 text-sm ${templateId === x.Id ? "border-primary bg-surface-2" : "border-line hover:bg-surface-2"}`}>
            <input type="radio" name="template" checked={templateId === x.Id} onChange={() => setTemplateId(x.Id)} className="mt-1" />
            <span><b className="block">{x.Title}</b><span className="text-muted">{x.Body}</span></span>
          </label>
        ))}
      </fieldset>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={onlyDue} onChange={(e) => setOnlyDue(e.target.checked)} className="mt-1" />
        <span><b>Yalnızca zamanı gelenlere</b><span className="block text-muted">Yeni traş olmuş müşteriye gitmez; saçı/sakalı uzamış olanlara gider.</span></span>
      </label>

      {t && (
        <div className="rounded-xl border border-dashed border-line p-3 text-sm">
          <p className="mb-1 text-xs font-semibold text-muted">Müşterinin telefonunda böyle görünecek:</p>
          <p className="font-bold">{fill(t.Title)}</p>
          <p>{fill(t.Body)}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={send} disabled={pending || !count}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-bold text-primary-ink disabled:opacity-50">
          <Send className="h-4 w-4" aria-hidden /> {pending ? "Gönderiliyor…" : "Gönder"}
        </button>
        <span className="text-sm text-muted">
          {count === null ? "Hesaplanıyor…" : count === 0 ? "Şu an mesaj gidecek müşteri yok." : `${count} müşterinize gidecek.`}
        </span>
      </div>
      {msg?.error && <p className="text-sm font-medium text-closed">{msg.error}</p>}
      {msg?.ok && <p className="text-sm font-medium text-open">{msg.ok}</p>}
    </div>
  );
}
