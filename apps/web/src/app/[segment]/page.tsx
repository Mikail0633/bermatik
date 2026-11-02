import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { HomePage } from "@/components/HomePage";
import { isSegment } from "@/lib/types";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ segment: string }> }): Promise<Metadata> {
  const { segment } = await params;
  if (segment !== "kadin") return {};
  return {
    title: "En yakın kadın kuaförü — online randevu",
    description: "Yakınındaki kadın kuaförlerini bul: saç, boya, manikür, pedikür, kaş-kirpik. Fiyatlar, yorumlar ve online randevu.",
    alternates: { canonical: "/kadin" },
  };
}

// /kadin → kadın ana sayfası; /erkek → ana sayfaya (/) yönlendirilir
export default async function Page({ params }: { params: Promise<{ segment: string }> }) {
  const { segment } = await params;
  if (!isSegment(segment)) notFound();
  if (segment === "erkek") permanentRedirect("/");
  return <HomePage segment="kadin" />;
}
