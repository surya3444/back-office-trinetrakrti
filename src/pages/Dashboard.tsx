import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, orderBy, doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { LayoutDashboard, Search, Inbox, Layers, CalendarClock, UserCheck, Archive, RotateCcw, X, StickyNote, Phone, Mail } from "lucide-react";
import type { PipelineStage } from "./Settings";
import { Loader, EmptyState } from "../components/ui";
import { FollowUpModal } from "../components/FollowUpModal";
import { advanceLeadStatus } from "../lib/leads";
import { logAction } from "../lib/audit";
import { useAuth } from "../lib/auth-context";
import { todayStr, relativeDay, isOverdue } from "../lib/dates";

interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  problem?: string;
  callType?: string;
  stage?: string;
  status: string;
  source?: string;
  followUpDate?: string | null;
  followUpNote?: string;
  convertedToClient?: boolean;
  createdAt?: any;
}

type FuFilter = "all" | "due" | "overdue" | "today" | "upcoming" | "none";

export default function Dashboard() {
  const { can } = useAuth();
  const canWrite = can("pipeline", "write") || can("leads", "write");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [callTypeFilter, setCallTypeFilter] = useState("all");
  const [fuFilter, setFuFilter] = useState<FuFilter>("all");

  // Unified follow-up prompt. `applyStatus` also advances the lead's stage.
  const [pending, setPending] = useState<{ lead: Lead; stage: string; applyStatus: boolean } | null>(null);
  const [detail, setDetail] = useState<Lead | null>(null);

  useEffect(() => {
    const q = query(collection(db, "bookings"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setLeads(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Lead[]);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    getDoc(doc(db, "settings", "pipeline")).then((s) => {
      if (s.exists() && s.data().stages) setStages(s.data().stages);
    });
  }, []);

  const stageNames = useMemo(() => new Set(stages.map((s) => s.name)), [stages]);
  const stageColor = (status: string) => stages.find((s) => s.name === status)?.color || "#6B7283";
  const isNew = (l: Lead) => l.status === "new" || l.status === "New";

  // KPI counts
  const counts = useMemo(() => ({
    total: leads.length,
    fresh: leads.filter(isNew).length,
    pipeline: leads.filter((l) => stageNames.has(l.status)).length,
    due: leads.filter((l) => l.followUpDate && l.followUpDate <= todayStr()).length,
    converted: leads.filter((l) => l.convertedToClient).length,
  }), [leads, stageNames]);

  const statusMatch = (l: Lead) => {
    switch (statusFilter) {
      case "all": return true;
      case "new": return isNew(l);
      case "pipeline": return stageNames.has(l.status);
      case "Archived": return l.status === "Archived";
      default: return l.status === statusFilter;
    }
  };

  const fuMatch = (l: Lead) => {
    const d = l.followUpDate;
    switch (fuFilter) {
      case "all": return true;
      case "none": return !d;
      case "due": return !!d && d <= todayStr();
      case "overdue": return !!d && isOverdue(d);
      case "today": return d === todayStr();
      case "upcoming": return !!d && d > todayStr();
    }
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (!statusMatch(l)) return false;
      if (callTypeFilter !== "all" && l.callType !== callTypeFilter) return false;
      if (!fuMatch(l)) return false;
      if (term) {
        const hay = [l.name, l.email, l.phone, l.company, l.problem, l.status, l.callType].join(" ").toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [leads, search, statusFilter, callTypeFilter, fuFilter, stageNames]);

  const resetFilters = () => { setStatusFilter("all"); setCallTypeFilter("all"); setFuFilter("all"); setSearch(""); };
  const hasFilters = statusFilter !== "all" || callTypeFilter !== "all" || fuFilter !== "all" || search !== "";

  const onStageChange = (lead: Lead, value: string) => {
    if (value === lead.status) return;
    if (value === "Archived") { updateDoc(doc(db, "bookings", lead.id), { status: "Archived" }).catch(console.error); return; }
    if (stages.find((s) => s.name === value)?.isFollowUp) { setPending({ lead, stage: value, applyStatus: true }); return; }
    advanceLeadStatus(lead, value, stages).catch(console.error);
  };

  const archive = async (lead: Lead) => {
    try { await updateDoc(doc(db, "bookings", lead.id), { status: "Archived" }); await logAction("Archived lead", lead.name); } catch (e) { console.error(e); }
  };
  const restore = async (lead: Lead) => {
    try { await updateDoc(doc(db, "bookings", lead.id), { status: stages[0]?.name || "new" }); await logAction("Restored lead", lead.name); } catch (e) { console.error(e); }
  };

  const fmtCreated = (ts: any) => {
    try { return ts?.toDate ? ts.toDate().toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—"; }
    catch { return "—"; }
  };

  if (loading) return <Loader label="Loading dashboard" sub="Pulling together every lead" />;

  const KPIS = [
    { key: "all", icon: LayoutDashboard, label: "Total leads", value: counts.total, accent: "#13182B", onClick: resetFilters, active: !hasFilters },
    { key: "new", icon: Inbox, label: "Need triage", value: counts.fresh, accent: "#FF5C49", onClick: () => { resetFilters(); setStatusFilter("new"); }, active: statusFilter === "new" },
    { key: "pipeline", icon: Layers, label: "In pipeline", value: counts.pipeline, accent: "#2B41E0", onClick: () => { resetFilters(); setStatusFilter("pipeline"); }, active: statusFilter === "pipeline" },
    { key: "due", icon: CalendarClock, label: "Follow-ups due", value: counts.due, accent: "#F59E0B", onClick: () => { resetFilters(); setFuFilter("due"); }, active: fuFilter === "due" },
    { key: "won", icon: UserCheck, label: "Converted", value: counts.converted, accent: "#0F9D6B", onClick: () => { resetFilters(); setStatusFilter(stages[stages.length - 1]?.name || "all"); }, active: statusFilter === stages[stages.length - 1]?.name },
  ];

  return (
    <div className="font-['Poppins',sans-serif]">
      {/* Header */}
      <div className="mb-7 animate-fade-up flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border bg-[#2B41E0]/[0.08] text-[#2B41E0] border-[#2B41E0]/20"><LayoutDashboard size={22} /></div>
        <div>
          <div className="font-mono text-[12px] tracking-[0.16em] uppercase font-medium flex items-center gap-2 mb-2 text-[#2B41E0]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2B41E0]" /> Lead Management
          </div>
          <h1 className="text-[28px] md:text-[34px] font-bold text-[#13182B] leading-none tracking-tight">Dashboard</h1>
          <p className="text-[#6B7283] mt-2.5 text-[15px] leading-relaxed max-w-2xl">A single view of every lead. Search, filter, and act — approve, advance a stage, schedule a follow-up, or archive — without leaving this screen.</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-7">
        {KPIS.map((k, i) => (
          <button
            key={k.key}
            onClick={k.onClick}
            style={{ animationDelay: `${i * 40}ms` }}
            className={`text-left bg-white border rounded-2xl p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md animate-fade-up ${k.active ? "border-[2px]" : "border-[#E5E2D9]"}`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${k.accent}14`, color: k.accent }}><k.icon size={18} /></div>
              {k.active && <span className="w-2 h-2 rounded-full" style={{ background: k.accent }} />}
            </div>
            <div className="text-[26px] font-bold leading-none tracking-tight" style={{ color: k.accent }}>{k.value}</div>
            <div className="font-mono text-[10.5px] tracking-[0.1em] uppercase text-[#9AA0AD] mt-2">{k.label}</div>
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="bg-white border border-[#D7D3C7] rounded-[20px] p-4 md:p-5 shadow-sm mb-5 animate-fade-up">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
          <div className="relative flex-1">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9AA0AD]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, phone, company, or problem…"
              className="w-full pl-10 pr-3 py-3 rounded-xl border border-[#D7D3C7] bg-[#FCFBF8] text-[#13182B] text-[14.5px] focus:border-[#2B41E0] outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Select value={statusFilter} onChange={setStatusFilter}>
              <option value="all">All statuses</option>
              <option value="new">New (triage)</option>
              <option value="pipeline">In pipeline</option>
              {stages.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
              <option value="Archived">Archived</option>
            </Select>
            <Select value={callTypeFilter} onChange={setCallTypeFilter}>
              <option value="all">All call types</option>
              <option value="clarity">Clarity</option>
              <option value="technical">Technical</option>
            </Select>
            <Select value={fuFilter} onChange={(v) => setFuFilter(v as FuFilter)}>
              <option value="all">Any follow-up</option>
              <option value="due">Due (incl. overdue)</option>
              <option value="overdue">Overdue</option>
              <option value="today">Today</option>
              <option value="upcoming">Upcoming</option>
              <option value="none">No follow-up</option>
            </Select>
            {hasFilters && (
              <button onClick={resetFilters} className="flex items-center gap-1.5 px-3.5 py-3 rounded-xl text-[13.5px] font-semibold text-[#6B7283] bg-[#F4F2EC] hover:bg-[#E5E2D9] transition-colors"><X size={15} /> Clear</button>
            )}
          </div>
        </div>
        <div className="mt-3 font-mono text-[12px] text-[#9AA0AD]">Showing {filtered.length} of {leads.length} leads</div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#D7D3C7] rounded-[20px] overflow-x-auto shadow-sm animate-fade-up">
        <table className="w-full text-left border-collapse min-w-[960px]">
          <thead className="bg-[#F4F2EC] text-[12.5px] text-[#6B7283] border-b border-[#E5E2D9]">
            <tr>
              <th className="p-4 font-semibold">Lead</th>
              <th className="p-4 font-semibold">Company</th>
              <th className="p-4 font-semibold">Stage</th>
              <th className="p-4 font-semibold">Type</th>
              <th className="p-4 font-semibold">Follow-up</th>
              <th className="p-4 font-semibold">Added</th>
              <th className="p-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E2D9]">
            {filtered.map((l) => {
              const archived = l.status === "Archived";
              const inStage = stageNames.has(l.status);
              return (
                <tr key={l.id} className={`hover:bg-[#FCFBF8] transition-colors ${archived ? "opacity-60" : ""}`}>
                  <td className="p-4 cursor-pointer" onClick={() => setDetail(l)}>
                    <div className="font-semibold text-[#13182B] text-[14.5px] flex items-center gap-2">
                      {l.name}
                      {l.source === "manual" && <span className="font-mono text-[9px] uppercase tracking-wider text-[#2B41E0] bg-[#EDEFFF] px-1.5 py-0.5 rounded">manual</span>}
                    </div>
                    <div className="text-[13px] text-[#6B7283] mt-0.5">{l.email}</div>
                    {l.phone && l.phone !== "N/A" && <div className="text-[13px] text-[#9AA0AD]">{l.phone}</div>}
                  </td>
                  <td className="p-4 text-[13.5px] text-[#3A4257]">{l.company && l.company !== "N/A" ? l.company : "—"}</td>
                  <td className="p-4">
                    <div className="inline-flex items-center gap-2 rounded-lg border border-[#D7D3C7] bg-[#FCFBF8] pl-2 pr-1 py-1">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: isNew(l) ? "#FF5C49" : archived ? "#9AA0AD" : stageColor(l.status) }} />
                      <select
                        value={inStage ? l.status : ""}
                        onChange={(e) => onStageChange(l, e.target.value)}
                        disabled={!canWrite}
                        className="bg-transparent text-[13px] font-semibold text-[#13182B] outline-none cursor-pointer pr-1 disabled:cursor-default"
                      >
                        {!inStage && <option value="" disabled>{isNew(l) ? "New" : l.status}</option>}
                        {stages.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                      </select>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="font-mono text-[11px] px-2.5 py-1 rounded-full font-semibold bg-[#EDEFFF] text-[#2B41E0] capitalize">{l.callType || "—"}</span>
                  </td>
                  <td className="p-4">
                    {l.followUpDate ? (
                      <span className={`font-mono text-[11px] px-2.5 py-1.5 rounded-md font-semibold inline-flex items-center gap-1.5 ${isOverdue(l.followUpDate) ? "bg-[#FFEDE9] text-[#FF5C49]" : "bg-[#FFF6E5] text-[#B7791F]"}`}>
                        <CalendarClock size={12} /> {relativeDay(l.followUpDate)}
                      </span>
                    ) : <span className="text-[#C4C0B4] text-[13px]">—</span>}
                  </td>
                  <td className="p-4 text-[13px] text-[#6B7283] whitespace-nowrap">{fmtCreated(l.createdAt)}</td>
                  <td className="p-4">
                    {canWrite ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <button title="Schedule follow-up" onClick={() => setPending({ lead: l, stage: l.status, applyStatus: false })} className="w-9 h-9 flex items-center justify-center rounded-lg text-[#B7791F] bg-[#FFF6E5] hover:bg-[#F59E0B] hover:text-white transition-colors"><CalendarClock size={16} /></button>
                        {archived ? (
                          <button title="Restore lead" onClick={() => restore(l)} className="w-9 h-9 flex items-center justify-center rounded-lg text-[#2B41E0] bg-[#EDEFFF] hover:bg-[#2B41E0] hover:text-white transition-colors"><RotateCcw size={16} /></button>
                        ) : (
                          <button title="Archive lead" onClick={() => archive(l)} className="w-9 h-9 flex items-center justify-center rounded-lg text-[#9AA0AD] bg-[#F4F2EC] hover:bg-[#FF5C49] hover:text-white transition-colors"><Archive size={16} /></button>
                        )}
                      </div>
                    ) : (
                      <div className="text-right font-mono text-[12px] text-[#C4C0B4] pr-2">view only</div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="p-6">
            <EmptyState icon={Search} title="No leads match" sub={hasFilters ? "Try widening your search or clearing the filters." : "Bookings from the website will appear here as they arrive."} />
          </div>
        )}
      </div>

      {/* Follow-up prompt */}
      {pending && (
        <FollowUpModal
          leadName={pending.lead.name}
          stageName={pending.stage}
          initialDate={pending.lead.followUpDate || todayStr()}
          initialNote={pending.lead.followUpNote || ""}
          onCancel={() => setPending(null)}
          onConfirm={async (date, note) => {
            const payload: Record<string, unknown> = { followUpDate: date, followUpNote: note };
            if (pending.applyStatus) payload.status = pending.stage;
            try {
              await updateDoc(doc(db, "bookings", pending.lead.id), payload);
              await logAction("Scheduled follow-up", `${pending.lead.name} on ${date}`);
            } catch (e) { console.error(e); }
            setPending(null);
          }}
        />
      )}

      {/* Lead detail */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#13182B] bg-opacity-40 backdrop-blur-sm animate-fade-in" onClick={() => setDetail(null)}>
          <div className="bg-white w-full max-w-xl border border-[#D7D3C7] rounded-[24px] shadow-2xl overflow-hidden animate-scale-in max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-[#E5E2D9] flex justify-between items-center bg-[#FCFBF8]">
              <div>
                <div className="font-mono text-[11px] uppercase font-semibold mb-1" style={{ color: stageColor(detail.status) }}>{detail.status}</div>
                <h2 className="text-[21px] font-bold text-[#13182B] leading-none">{detail.name}</h2>
              </div>
              <button onClick={() => setDetail(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#E5E2D9] text-[#6B7283] hover:bg-[#D7D3C7]"><X size={16} strokeWidth={2.5} /></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-5 text-[15px]">
              <div className="grid sm:grid-cols-2 gap-4">
                <Detail icon={Mail} label="Email" value={detail.email} />
                <Detail icon={Phone} label="Phone" value={detail.phone || "N/A"} />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Detail label="Company" value={detail.company && detail.company !== "N/A" ? detail.company : "—"} />
                <Detail label="Call type" value={detail.callType || "—"} />
              </div>
              {detail.stage && <Detail label="Reported stage" value={detail.stage} />}
              {detail.problem && (
                <div>
                  <div className="font-mono text-[11px] text-[#9AA0AD] uppercase mb-2">The problem</div>
                  <div className="bg-[#F4F2EC] border border-[#D7D3C7] p-4 rounded-xl text-[#3A4257] leading-relaxed">{detail.problem}</div>
                </div>
              )}
              {detail.followUpDate && (
                <div className="flex items-start gap-3 bg-[#FFF6E5] border border-[#F59E0B]/30 rounded-xl p-4">
                  <CalendarClock size={18} className="text-[#B7791F] shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-[#13182B] text-[14px]">Follow-up {relativeDay(detail.followUpDate).toLowerCase()}</div>
                    {detail.followUpNote && <div className="text-[13.5px] text-[#8a6420] mt-1 flex items-start gap-1.5"><StickyNote size={13} className="shrink-0 mt-0.5" /> {detail.followUpNote}</div>}
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-[#E5E2D9] bg-[#FCFBF8] flex gap-3 justify-end">
              <button onClick={() => { setPending({ lead: detail, stage: detail.status, applyStatus: false }); setDetail(null); }} className="px-5 py-2.5 rounded-xl font-semibold text-[14px] text-[#B7791F] bg-[#FFF6E5] hover:bg-[#F59E0B] hover:text-white transition-colors flex items-center gap-2"><CalendarClock size={16} /> Follow-up</button>
              <button onClick={() => setDetail(null)} className="px-5 py-2.5 rounded-xl font-semibold text-[14px] text-white bg-[#13182B] hover:-translate-y-0.5 transition-transform shadow-md">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="px-3.5 py-3 rounded-xl border border-[#D7D3C7] bg-[#FCFBF8] text-[#13182B] text-[13.5px] font-medium focus:border-[#2B41E0] outline-none cursor-pointer">
      {children}
    </select>
  );
}

function Detail({ icon: Icon, label, value }: { icon?: React.ComponentType<{ size?: number; className?: string }>; label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[11px] text-[#9AA0AD] uppercase mb-1 flex items-center gap-1.5">{Icon && <Icon size={12} />}{label}</div>
      <div className="font-medium text-[#13182B] break-words">{value}</div>
    </div>
  );
}
