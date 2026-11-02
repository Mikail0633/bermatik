"use client";

import { useActionState, useEffect, useRef } from "react";
import { addPhoneBooking, type PanelState } from "@/app/panel/actions";
import { FormError, SubmitButton } from "@/components/forms";

export function PhoneBookingForm({ shopId, day, services, staff }: { shopId: string; day: string; services: { Id: string; Name: string }[]; staff: { Id: string; DisplayName: string }[] }) {
  const [state, action] = useActionState<PanelState, FormData>(addPhoneBooking, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  const input = "w-full rounded-lg border border-line px-3 py-2";
  return (
    <form ref={ref} action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="shopId" value={shopId} />
      <div className="sm:col-span-2"><FormError message={state?.error} />{state?.ok && <p className="rounded-xl bg-open/10 px-3 py-2 text-sm font-medium text-open">{state.ok}</p>}</div>
      <label className="text-sm"><span className="mb-1 block font-semibold">Müşteri adı</span><input name="customerName" required className={input} /></label>
      <label className="text-sm"><span className="mb-1 block font-semibold">Telefonu</span><input name="customerPhone" type="tel" required className={input} /></label>
      <fieldset className="text-sm sm:col-span-2">
        <legend className="mb-1 font-semibold">Hizmet</legend>
        <div className="flex flex-wrap gap-2">
          {services.map((s) => (
            <label key={s.Id} className="flex items-center gap-1 rounded-lg border border-line px-3 py-1.5"><input type="checkbox" name="services" value={s.Id} /> {s.Name}</label>
          ))}
        </div>
      </fieldset>
      <label className="text-sm"><span className="mb-1 block font-semibold">Personel</span>
        <select name="staffId" className={input}>{staff.map((s) => <option key={s.Id} value={s.Id}>{s.DisplayName}</option>)}</select></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm"><span className="mb-1 block font-semibold">Gün</span><input type="date" name="date" defaultValue={day} required className={input} /></label>
        <label className="text-sm"><span className="mb-1 block font-semibold">Saat</span><input type="time" name="time" required step={300} className={input} /></label>
      </div>
      <label className="text-sm sm:col-span-2"><span className="mb-1 block font-semibold">Not</span><input name="note" className={input} /></label>
      <div className="sm:col-span-2 sm:w-60"><SubmitButton>Randevuyu ekle</SubmitButton></div>
    </form>
  );
}
