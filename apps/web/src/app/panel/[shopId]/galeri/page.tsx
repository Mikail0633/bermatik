import { call } from "@/lib/db";
import { GalleryGrid, GalleryUpload, StaffPhotoUpload, type GalleryPhoto } from "@/components/PhotoUpload";
import { getPanelView, loadPanelShop } from "../data";

export const metadata = { title: "Fotoğraflar" };

type StaffRow = { Id: string; DisplayName: string; PhotoPath: string | null; IsActive: boolean; IsMe: boolean };

// Sahip/admin: tüm galeri, kimin işi olduğunu seçer. Personel: kendi fotoğrafı ve kendi işleri.
export default async function Page({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  const { user, shop } = await loadPanelShop(shopId);
  const isAdmin = user.Role === "admin";
  const canManage = (shop.IsOwner || isAdmin) && (await getPanelView()) !== "personel";
  const [photos, staff] = await Promise.all([
    call<GalleryPhoto>("api.Gallery_List", { ShopId: shopId, ActorId: user.Id }),
    call<StaffRow>("api.Staff_List", { ShopId: shopId, ActorId: user.Id }),
  ]);
  const me = staff.find((s) => s.IsMe);
  const box = "rounded-2xl border border-line bg-surface p-5";
  return (
    <div className="space-y-6">
      {me && (
        <section className={box}>
          <h2 className="mb-1 text-lg font-bold">Profil fotoğrafınız</h2>
          <p className="mb-3 text-sm text-muted">Müşteriler randevu alırken personel seçiminde bu fotoğrafı görür.</p>
          <StaffPhotoUpload staffId={me.Id} current={me.PhotoPath} />
        </section>
      )}
      <section className={box}>
        <h2 className="mb-1 text-lg font-bold">Galeriye fotoğraf ekle</h2>
        <p className="mb-3 text-sm text-muted">Yaptığınız işlerin ve dükkânın fotoğrafları dükkân sayfanızda görünür. Fotoğraflar küçültülür, içindeki konum bilgisi silinir.</p>
        <GalleryUpload shopId={shopId} staff={canManage ? staff.filter((s) => s.IsActive) : undefined} />
      </section>
      <section className={box}>
        <h2 className="mb-3 text-lg font-bold">Galeri ({photos.length}/60)</h2>
        <GalleryGrid photos={photos.map((p) => ({ ...p, CanRemove: canManage || (!!me && p.StaffId === me.Id) }))} />
      </section>
    </div>
  );
}
