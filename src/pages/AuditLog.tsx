import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { db } from "../lib/firebase";
import { History, Search } from "lucide-react";
import { PageHeader, Loader, EmptyState } from "../components/ui";

interface Entry {
  id: string;
  action: string;
  details?: string;
  actorName?: string;
  actorEmail?: string;
  at?: any;
}

function timeAgo(ts: any): string {
  try {
    const d: Date = ts?.toDate ? ts.toDate() : new Date(ts);
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch { return "—"; }
}

export default function AuditLog() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const q = query(collection(db, "auditLogs"), orderBy("at", "desc"), limit(200));
    const unsub = onSnapshot(q, (snap) => {
      setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Entry[]);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return entries;
    return entries.filter((e) => [e.action, e.details, e.actorName, e.actorEmail].join(" ").toLowerCase().includes(t));
  }, [entries, search]);

  if (loading) return <Loader label="Loading activity" sub="Reading the audit trail" />;

  return (
    <div className="font-['Inter',sans-serif]">
      <PageHeader
        icon={History}
        eyebrow="Administration"
        accent="#5A6473"
        title="Activity Log"
        subtitle="A running record of who changed what across the workspace — leads, follow-ups, members, roles and settings."
        stats={[{ label: "Events", value: entries.length, accent: "#17222F" }]}
      />

      <div className="relative mb-5 max-w-md animate-fade-up">
        <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9AA0AD]" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search actions or people…" className="w-full pl-10 pr-3 py-3 rounded-none border border-[#17222F] bg-[#FFFFFF] text-[#17222F] text-[14.5px] focus:border-[#E5322B] outline-none" />
      </div>

      <div className="bg-white border border-[#17222F] rounded-none overflow-hidden animate-fade-up">
        {filtered.length === 0 ? (
          <div className="p-6"><EmptyState icon={History} title="No activity" sub="Actions taken in the back office will show up here." /></div>
        ) : (
          <ul className="divide-y divide-[#17222F]">
            {filtered.map((e) => (
              <li key={e.id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-[#FFFFFF] transition-colors">
                <div className="w-9 h-9 rounded-none bg-[#F2F2F2] text-[#5A6473] flex items-center justify-center shrink-0 mt-0.5 font-semibold text-[13px]">
                  {(e.actorName || e.actorEmail || "?").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14.5px] text-[#17222F]">
                    <span className="font-semibold">{e.actorName || e.actorEmail || "Someone"}</span>{" "}
                    <span className="text-[#2E3744]">{e.action.toLowerCase()}</span>
                    {e.details && <span className="text-[#5A6473]"> — {e.details}</span>}
                  </div>
                  <div className="font-mono text-[11.5px] text-[#9AA0AD] mt-0.5">{e.actorEmail}</div>
                </div>
                <div className="font-mono text-[12px] text-[#9AA0AD] whitespace-nowrap shrink-0 mt-1">{timeAgo(e.at)}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
