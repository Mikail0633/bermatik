import "server-only";
import { clientIp } from "./auth";
import { call } from "./db";

// Formdaki <BotFields /> alanlarını kontrol eder. Bot ise kaydeder ve gerçek kişiye
// yanlışlıkla engel olmamak için anlaşılır bir mesaj döner (insan tekrar deneyebilir).
// minMs: formun en erken kaç ms sonra gönderilebileceği (giriş formunda 0: kayıtlı şifreyle anında girilebilir)
export async function isBot(form: FormData, formName: string, minMs = 2000): Promise<string | null> {
  let reason: string | null = null;
  if (String(form.get("website") ?? "") !== "") reason = "tuzak";
  else {
    const age = Number(form.get("_t")); // formun açık kaldığı süre (ms)
    if (!age) reason = "zaman-yok";
    else if (age < minMs) reason = "cok-hizli";
    else if (age > 24 * 3600_000) reason = "eski-form";
  }
  if (!reason) return null;
  await call("api.Bot_Log", { Form: formName, Reason: reason, IpAddress: await clientIp() }).catch(() => {});
  return reason === "eski-form"
    ? "Sayfa çok uzun süre açık kaldı. Sayfayı yenileyip tekrar deneyin."
    : "Gönderilemedi. Sayfayı yenileyip birkaç saniye sonra tekrar deneyin.";
}
