"use client";

import { useEffect, useRef } from "react";

// Bot koruması (görünmez): formun içine konur.
//  • "website" alanı insanlara görünmez; onu dolduran bottur.
//  • "_t": form kaç milisaniyedir açık (cihaz saatinden bağımsız ölçülür). Çok hızlı gönderen bottur;
//    tarayıcıda çalışmayan (JavaScript'siz) botlarda boş gelir.
export function BotFields() {
  const t = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const start = performance.now();
    const tick = () => { if (t.current) t.current.value = String(Math.max(1, Math.round(performance.now() - start))); };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, []);
  return (
    <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
      <label>Web siteniz (boş bırakın)<input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" /></label>
      <input ref={t} type="hidden" name="_t" defaultValue="" />
    </div>
  );
}
