// Bermatik yazı logosu + makas simgesi (renkleri bölüme göre değişir)
// compact: 400 pikselden dar ekranda yazıyı gizler, yalnız makas simgesi kalır (üst menü sığsın)
export function Logo({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 font-extrabold tracking-tight text-ink ${className}`}>
      <svg viewBox="0 0 32 32" aria-hidden="true" className="h-8 w-8">
        <rect width="32" height="32" rx="8" className="fill-logo-bg" />
        <g className="stroke-logo-fg" fill="none" strokeWidth="2.2" strokeLinecap="round">
          <circle cx="10" cy="22" r="3.2" />
          <circle cx="22" cy="22" r="3.2" />
          <path d="M12.4 19.8 23 7.5M19.6 19.8 9 7.5" />
        </g>
      </svg>
      <span className={`text-xl ${compact ? "max-[399px]:sr-only" : ""}`}>
        Ber<span className="text-accent">matik</span>
      </span>
    </span>
  );
}
