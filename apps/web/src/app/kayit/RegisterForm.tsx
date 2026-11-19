"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { register, type FormState } from "../giris/actions";
import { Field, FormError, SubmitButton } from "@/components/forms";
import { BotFields } from "@/components/BotFields";
import { PasswordField } from "@/components/PasswordField";
import { DocumentFields } from "@/components/DocumentUpload";

export function RegisterForm({ next, business = false, consentEnabled = false }: { next: string; business?: boolean; consentEnabled?: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(register, undefined);
  const v = state?.values ?? {};
  const [type, setType] = useState(v.accountType || (business ? "isletme" : "musteri"));
  return (
    <form action={action} className="space-y-4">
      <BotFields />
      <input type="hidden" name="sonra" value={next} />
      <FormError message={state?.error} />
      <fieldset>
        <legend className="mb-1 text-sm font-semibold">Hesap türü</legend>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: "musteri", title: "Müşteri", text: "Randevu alırım" },
            { value: "isletme", title: "İşletme", text: "Berber, kuaför veya personelim" },
          ].map((o) => (
            <label key={o.value} className="cursor-pointer rounded-xl border border-line p-3 has-[:checked]:border-primary has-[:checked]:bg-surface-2">
              <input type="radio" name="accountType" value={o.value} className="sr-only"
                checked={type === o.value} onChange={() => setType(o.value)} />
              <span className="block font-semibold">{o.title}</span>
              <span className="block text-xs text-muted">{o.text}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ad" name="firstName" autoComplete="given-name" required defaultValue={v.firstName} />
        <Field label="Soyad" name="lastName" autoComplete="family-name" required defaultValue={v.lastName} />
      </div>
      <Field label="E-posta" name="email" type="email" autoComplete="email" required defaultValue={v.email} />
      <Field
        label="Telefon"
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="05xx xxx xx xx"
        required
        defaultValue={v.phone}
        hint="Randevunuzla ilgili dükkân size ulaşabilsin diye."
      />
      <Field label={type === "isletme" ? "Doğum yılı" : "Doğum yılı (isteğe bağlı)"} name="birthYear" inputMode="numeric" placeholder="1995" defaultValue={v.birthYear}
        hint={type === "isletme" ? "Kimlikle doğrulamada nüfus kaydıyla karşılaştırılır." : undefined} />
      <PasswordField />
      {type === "isletme" && (
        <fieldset className="space-y-2 rounded-xl border border-line p-3">
          <legend className="px-1 text-sm font-semibold">İşletme doğrulama belgesi</legend>
          <p className="text-xs text-muted">
            Sahte işletme hesaplarını önlemek için bir belge istiyoruz. <b>Kimlik</b> seçerseniz ad, soyad, doğum yılı ve
            T.C. numaranız nüfus kayıtlarından kontrol edilir ve paneliniz hemen açılır; diğer belgelerde Bermatik ekibi
            inceleyip onaylayınca açılır. Bir belge yalnızca bir hesapta kullanılabilir. Belgenizi yalnızca Bermatik ekibi görür.
          </p>
          <DocumentFields defaultKind="kimlik" />
        </fieldset>
      )}
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="kvkk" required defaultChecked={v.kvkk === "on"} className="mt-1 h-4 w-4 accent-[var(--primary)]" />
        <span>
          <Link href="/kvkk" target="_blank" className="font-semibold underline">KVKK aydınlatma metnini</Link> okudum, kişisel
          verilerimin randevu hizmeti için işlenmesini kabul ediyorum.
        </span>
      </label>
      {consentEnabled && (
        <fieldset className="space-y-2 rounded-xl border border-line p-3 text-sm">
          <legend className="px-1 font-semibold">Kampanya ve fırsatlar <span className="font-normal text-muted">(isteğe bağlı)</span></legend>
          <label className="flex items-start gap-2">
            <input type="checkbox" name="consentEmail" defaultChecked={v.consentEmail === "on"} className="mt-1 h-4 w-4 accent-[var(--primary)]" />
            <span>Kampanya ve fırsatlardan <b>e-posta</b> ile haberdar olmak istiyorum.</span>
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" name="consentSms" defaultChecked={v.consentSms === "on"} className="mt-1 h-4 w-4 accent-[var(--primary)]" />
            <span>Kampanya ve fırsatlardan <b>SMS</b> ile haberdar olmak istiyorum.</span>
          </label>
          <p className="text-xs text-muted">İstediğiniz zaman Hesabım sayfasından ya da iletideki bağlantıdan vazgeçebilirsiniz.</p>
        </fieldset>
      )}
      <SubmitButton>Kayıt ol</SubmitButton>
    </form>
  );
}
