import { getUser } from "@/lib/auth";
import { callOne } from "@/lib/db";
import { readPrivateFile } from "@/lib/uploads";

// Ustalık / kalfalık belgesi: yalnızca yükleyen kişi ve admin görebilir
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user || !/^[0-9a-f-]{36}$/i.test(id)) return new Response("Bulunamadı", { status: 404 });
  const row = await callOne<{ FilePath: string }>("api.Certificate_GetFile", { ActorId: user.Id, CertificateId: id });
  const file = row && (await readPrivateFile(row.FilePath));
  if (!file) return new Response("Bulunamadı", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.type,
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
