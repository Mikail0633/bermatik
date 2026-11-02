import { requireAdmin } from "@/lib/auth";
import { call } from "@/lib/db";
import { ActionButton } from "@/components/ActionButton";
import { reviewOwnerDocument } from "@/app/admin/actions";

type Doc = { Id: string; Kind: string; Status: string; ReviewNote: string | null };
const KIND: Record<string, string> = { vergi_levhasi: "Vergi levhası", esnaf_kaydi: "Esnaf odası kaydı", diger: "Diğer belge" };

// Sahiplenme talebine ya da dükkân başvurusuna yüklenen belgeler (admin görür, onaylar)
export async function OwnerDocs({ shopId, claimId }: { shopId?: string; claimId?: string }) {
  const admin = await requireAdmin();
  const docs = await call<Doc>("api.OwnerDocument_List", { ActorId: admin.Id, ShopId: shopId ?? null, ClaimId: claimId ?? null });
  if (docs.length === 0) return <p className="text-sm font-semibold text-closed">⚠️ Sahiplik belgesi yüklenmedi.</p>;
  return (
    <ul className="space-y-2">
      {docs.map((d) => (
        <li key={d.Id} className="flex flex-wrap items-center gap-2 text-sm">
          <a href={`/api/belge/${d.Id}`} target="_blank" className="font-semibold underline">📄 {KIND[d.Kind] ?? d.Kind}</a>
          <span className="text-muted">{d.Status === "pending" ? "· bakılmadı" : d.Status === "approved" ? "· ✓ uygun" : `· ✗ uygun değil${d.ReviewNote ? `: ${d.ReviewNote}` : ""}`}</span>
          {d.Status === "pending" && <>
            <ActionButton variant="success" action={reviewOwnerDocument.bind(null, d.Id, "approved", undefined)}>Uygun</ActionButton>
            <ActionButton variant="danger" action={reviewOwnerDocument.bind(null, d.Id, "rejected", "Belge okunamadı veya dükkânla eşleşmiyor")}>Uygun değil</ActionButton>
          </>}
        </li>
      ))}
    </ul>
  );
}
