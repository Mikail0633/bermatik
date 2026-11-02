import { requireAdmin } from "@/lib/auth";
import { call } from "@/lib/db";
import { ActionButton } from "@/components/ActionButton";
import { setUserActive } from "../actions";
import { RoleSelect } from "./RoleSelect";

export const metadata = { title: "Kullanıcılar" };
export const dynamic = "force-dynamic";

type User = {
  Id: string; Email: string; Role: string; FirstName: string; LastName: string; BirthYear: number | null;
  Phone: string | null; IsActive: boolean; CreatedAtLocal: Date;
};
const ROLES: Record<string, string> = { customer: "Müşteri", shop_owner: "Dükkân sahibi", staff: "Personel", admin: "Admin" };
const when = (d: Date) => new Intl.DateTimeFormat("tr-TR", { timeZone: "UTC", dateStyle: "medium" }).format(new Date(d));

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; rol?: string }> }) {
  const admin = await requireAdmin();
  const { q, rol } = await searchParams;
  // Sitenin iç sistem hesabı (sistem@bermatik.local) listelenmez
  const users = (await call<User>("api.Admin_User_List", { ActorId: admin.Id, Search: q?.trim() || null, Role: rol && ROLES[rol] ? rol : null }))
    .filter((u) => !u.Email.endsWith("@bermatik.local"));
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-extrabold">Kullanıcılar</h1>
      <form className="mt-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Ad, e-posta veya telefon ara" className="min-w-60 flex-1 rounded-xl border border-line bg-surface px-3 py-2" />
        <select name="rol" defaultValue={rol ?? ""} className="rounded-xl border border-line bg-surface px-3 py-2">
          <option value="">Tüm roller</option>
          {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="rounded-xl bg-primary px-4 py-2 font-semibold text-primary-ink">Ara</button>
      </form>
      <p className="mt-2 text-sm text-muted">{users.length === 200 ? "İlk 200 kullanıcı gösteriliyor; aramayı daraltın." : `${users.length} kullanıcı`}</p>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-surface-2 text-left">
            <tr><th className="p-3">Ad</th><th className="p-3">E-posta / telefon</th><th className="p-3">Kayıt</th><th className="p-3">Rol</th><th className="p-3">Durum</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.map((u) => (
              <tr key={u.Id} className={u.IsActive ? "" : "bg-closed/5"}>
                <td className="p-3 font-semibold">{u.FirstName} {u.LastName}{u.BirthYear ? <span className="font-normal text-muted"> · {u.BirthYear}</span> : null}</td>
                <td className="p-3">{u.Email}<br /><span className="text-muted">{u.Phone ?? "—"}</span></td>
                <td className="p-3 text-muted">{when(u.CreatedAtLocal)}</td>
                <td className="p-3">{u.Id === admin.Id ? ROLES[u.Role] : <RoleSelect userId={u.Id} role={u.Role} roles={ROLES} />}</td>
                <td className="p-3">
                  {u.Id === admin.Id ? <span className="text-muted">Siz</span> : u.IsActive ? (
                    <ActionButton variant="danger" confirm={`${u.FirstName} ${u.LastName} engellensin mi? Hemen oturumu kapanır, giriş yapamaz.`} action={setUserActive.bind(null, u.Id, false)}>Engelle</ActionButton>
                  ) : (
                    <ActionButton variant="success" action={setUserActive.bind(null, u.Id, true)}>Engeli kaldır</ActionButton>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
