import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

// E-posta gönderimi. Sırayla:
//   1) GMAIL_USER + GMAIL_APP_PASSWORD varsa Gmail'den (uygulama şifresiyle SMTP)
//   2) BREVO_API_KEY varsa Brevo'dan
//   3) Hiçbiri yoksa geliştirme modu: e-posta gönderilmez, içerik sunucu çıktısına yazılır ve false döner.

let gmail: Transporter | undefined;

export async function sendMail(to: { email: string; name?: string }, subject: string, text: string): Promise<boolean> {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  if (gmailUser && gmailPass) {
    gmail ??= nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: gmailUser, pass: gmailPass.replace(/\s/g, "") }, // Google şifreyi boşluklu gösterir
    });
    await gmail.sendMail({
      from: { name: "Bermatik", address: gmailUser },
      to: { name: to.name ?? "", address: to.email },
      subject,
      text,
    });
    return true;
  }

  const key = process.env.BREVO_API_KEY;
  if (!key) {
    console.log(`[e-posta - gönderilmedi, e-posta ayarı yok] ${to.email}: ${subject}\n${text}`);
    return false;
  }
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { email: process.env.MAIL_FROM ?? "no-reply@bermatik.com", name: "Bermatik" },
      to: [{ email: to.email, name: to.name }],
      subject,
      textContent: text,
    }),
  });
  if (!res.ok) throw new Error(`E-posta gönderilemedi (${res.status})`);
  return true;
}

export const mailConfigured = () =>
  Boolean((process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) || process.env.BREVO_API_KEY);
