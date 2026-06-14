import type { ComponentType, ReactNode } from "react";

// ── Loader ────────────────────────────────────────────────────────────────
// Minimal, elegant loading animation: a single smooth gradient arc (coral →
// blue) sweeping around a soft track, with a quietly pulsing label.
export function Loader({ label = "Loading", sub }: { label?: string; sub?: string }) {
  return (
    <div className="w-full flex flex-col items-center justify-center py-24 gap-5 animate-fade-in">
      <svg width="46" height="46" viewBox="0 0 50 50" className="animate-spin" style={{ animationDuration: "0.9s" }}>
        <defs>
          <linearGradient id="ol-spin" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF5C49" />
            <stop offset="100%" stopColor="#2B41E0" />
          </linearGradient>
        </defs>
        <circle cx="25" cy="25" r="20" fill="none" stroke="#E9E6DD" strokeWidth="5" />
        <circle cx="25" cy="25" r="20" fill="none" stroke="url(#ol-spin)" strokeWidth="5" strokeLinecap="round" strokeDasharray="80 200" />
      </svg>
      <div className="text-center">
        <div className="font-mono text-[12px] tracking-[0.22em] uppercase text-[#6B7283] animate-pulse">{label}</div>
        {sub && <div className="text-[13px] text-[#9AA0AD] mt-1.5">{sub}</div>}
      </div>
    </div>
  );
}

// ── Stat chip ─────────────────────────────────────────────────────────────
export interface Stat {
  label: string;
  value: ReactNode;
  accent?: string;
}

export function StatChip({ label, value, accent = "#13182B" }: Stat) {
  return (
    <div className="bg-white border border-[#E5E2D9] rounded-2xl px-4 py-2.5 min-w-[92px] shadow-sm">
      <div className="text-[22px] font-bold leading-none tracking-tight" style={{ color: accent }}>{value}</div>
      <div className="font-mono text-[10.5px] tracking-[0.12em] uppercase text-[#9AA0AD] mt-1.5 whitespace-nowrap">{label}</div>
    </div>
  );
}

// ── Page header ───────────────────────────────────────────────────────────
// Sleek, subtle section header: a soft icon, a quiet eyebrow, a tight title,
// stats merged into one segmented group, and a hairline divider for structure.
export function PageHeader({
  icon: Icon,
  eyebrow,
  accent = "#2B41E0",
  title,
  subtitle,
  stats = [],
  actions,
}: {
  icon?: ComponentType<{ size?: number }>;
  eyebrow?: string;
  accent?: string;
  title: string;
  subtitle?: string;
  stats?: Stat[];
  actions?: ReactNode;
}) {
  return (
    <div className="mb-7 animate-fade-up">
      <div className="flex items-start justify-between gap-5 flex-wrap">
        <div className="flex items-center gap-3.5 min-w-0">
          {Icon && (
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${accent}12`, color: accent }}>
              <Icon size={20} />
            </div>
          )}
          <div className="min-w-0">
            {eyebrow && (
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="w-[5px] h-[5px] rounded-full" style={{ background: accent }} />
                <span className="font-mono text-[11px] tracking-[0.16em] uppercase font-medium" style={{ color: accent }}>{eyebrow}</span>
              </div>
            )}
            <h1 className="text-[24px] md:text-[26px] font-bold text-[#13182B] leading-none tracking-[-0.02em]">{title}</h1>
          </div>
        </div>

        {(stats.length > 0 || actions) && (
          <div className="flex items-center gap-3 flex-wrap">
            {stats.length > 0 && (
              <div className="flex items-stretch rounded-xl border border-[#E9E6DD] bg-white/70 overflow-hidden divide-x divide-[#EEEBE3]">
                {stats.map((s, i) => (
                  <div key={i} className="px-4 py-2 text-center min-w-[70px]">
                    <div className="text-[18px] font-bold leading-none tracking-tight" style={{ color: s.accent || "#13182B" }}>{s.value}</div>
                    <div className="font-mono text-[9.5px] tracking-[0.1em] uppercase text-[#9AA0AD] mt-1.5 whitespace-nowrap">{s.label}</div>
                  </div>
                ))}
              </div>
            )}
            {actions}
          </div>
        )}
      </div>

      {subtitle && <p className="text-[#6B7283] mt-3 text-[14px] leading-relaxed max-w-2xl">{subtitle}</p>}

      <div className="mt-5 border-b border-[#EAE7DE]" />
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, sub }: { icon: ComponentType<{ size?: number }>; title: string; sub: string }) {
  return (
    <div className="border-2 border-dashed border-[#D7D3C7] rounded-[20px] p-12 flex flex-col items-center justify-center text-center bg-white/50 animate-fade-in">
      <div className="w-16 h-16 rounded-full bg-[#F4F2EC] flex items-center justify-center text-[#9AA0AD] mb-4">
        <Icon size={24} />
      </div>
      <h3 className="text-[#13182B] font-bold text-[18px] mb-2">{title}</h3>
      <p className="text-[#6B7283] text-[15px] max-w-sm">{sub}</p>
    </div>
  );
}
