import { HomePage } from "@/components/HomePage";

// Erkek ana sayfası (kadın: /kadin). Açık/kapalı ve bugünkü randevu sayısı için dakikada bir yenilenir.
export const revalidate = 60;

export default function Page() {
  return <HomePage segment="erkek" />;
}
