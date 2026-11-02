// Admin haritası renkleri ve nokta tipi (sunucu ve tarayıcı tarafı birlikte kullanır)
export type AdminPoint = {
  Id: string; Code: string; Segment: "erkek" | "kadin"; Name: string; Status: string; IsClaimed: boolean; NeedsReview: boolean;
  Latitude: number; Longitude: number; District: string;
};

// Erkek mavi, kadın pembe; onay bekleyen turuncu kenarlı, kontrol bekleyen sarı kenarlı
export const COLORS = { erkek: "#3b82f6", kadin: "#ec4899", pending: "#f97316", review: "#facc15" };
