import { readPublicPhoto } from "@/lib/uploads";

// Herkese açık fotoğraflar (kapak, galeri, personel). Dosya adı rastgele ve
// içerik hiç değişmediği için tarayıcı bir yıl önbellekte tutabilir.
export async function GET(_: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const data = await readPublicPhoto(path.join("/"));
  if (!data) return new Response("Bulunamadı", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
