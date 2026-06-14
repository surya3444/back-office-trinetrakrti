import { useEffect, useState } from "react";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "../lib/firebase";
import { X, Save, CalendarClock, Archive, RotateCcw, Mail, Phone, Building2, User, StickyNote, Clock, Info, CheckCircle2, ArrowRightCircle, Pencil } from "lucide-react";
import type { PipelineStage } from "../pages/Settings";
import { FollowUpModal } from "./FollowUpModal";
import { StageNoteModal } from "./StageNoteModal";
import { NotePromptModal } from "./NotePromptModal";
import { advanceLeadStatus, leadNote, type LeadNote } from "../lib/leads";
import { logAction } from "../lib/audit";
import { relativeDay, isOverdue } from "../lib/dates";

export interface DrawerLead {
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
  createdByName?: string;
  followUpDate?: string | null;
  followUpNote?: string;
  lastStageNote?: string | null;
  notes?: LeadNote[];
  convertedToClient?: boolean;
  createdAt?: any;
}

function timeAgo(ts: any): string {
  try {
    const d: Date = ts?.toDate ? ts.toDate() : new Date(ts);
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch { return ""; }
}

function noteMeta(n: LeadNote): { icon: any; color: string; label: string } {
  switch (n.type) {
    case "stage": return { icon: ArrowRightCircle, color: "#2B41E0", label: n.stage ? `moved to ${n.stage}` : "moved stage" };
    case "followup": return { icon: CalendarClock, color: "#B7791F", label: n.date ? `set a follow-up for ${relativeDay(n.date).toLowerCase()}` : "set a follow-up" };
    case "done": return { icon: CheckCircle2, color: "#0F9D6B", label: "completed the follow-up" };
    case "edit": return { icon: Pencil, color: "#9AA0AD", label: "edited the details" };
    default: return { icon: Clock, color: "#9AA0AD", label: String(n.type) };
  }
}

export function LeadDrawer({ lead, stages, canWrite, onClose }: { lead: DrawerLead; stages: PipelineStage[]; canWrite: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<"details" | "activity">("details");
  const [form, setForm] = useState({ name: "", company: "", email: "", phone: "", callType: "clarity", problem: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pendingFU, setPendingFU] = useState<{ stage: string; applyStatus: boolean } | null>(null);
  const [pendingMove, setPendingMove] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);

  // Timeline of stage notes & follow-ups, newest first (lives on the lead doc).
  const timeline = [...(lead.notes || [])].sort((a, b) => (b.at || 0) - (a.at || 0));

  const stageColor = (s: string) => stages.find((x) => x.name === s)?.color || "#6B7283";
  const stageNames = new Set(stages.map((s) => s.name));
  const archived = lead.status === "Archived";
  const inStage = stageNames.has(lead.status);

  // Reset the edit form only when switching to a different lead.
  useEffect(() => {
    setForm({
      name: lead.name || "", company: lead.company && lead.company !== "N/A" ? lead.company : "",
      email: lead.email || "", phone: lead.phone && lead.phone !== "N/A" ? lead.phone : "",
      callType: lead.callType || "clarity", problem: lead.problem || "",
    });
    setSaved(false); setTab("details");
  }, [lead.id]);

  const saveDetails = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, "bookings", lead.id), {
        name: form.name, company: form.company || "N/A", email: form.email,
        phone: form.phone || "N/A", callType: form.callType, problem: form.problem,
        notes: arrayUnion(leadNote("edit", { text: "Updated lead details" })),
      });
      await logAction("Edited lead details", form.name, lead.id);
      setSaved(true); setTimeout(() => setSaved(false), 2200);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const completeFollowUp = async (outcome: string) => {
    try {
      await updateDoc(doc(db, "bookings", lead.id), {
        followUpDate: null,
        notes: arrayUnion(leadNote("done", { text: outcome, date: lead.followUpDate || "" })),
      });
      await logAction("Completed follow-up", `${lead.name}${outcome ? ` — “${outcome}”` : ""}`, lead.id);
    } catch (e) { console.error(e); }
    setCompleting(false);
  };

  const onStageChange = (value: string) => {
    if (value === lead.status) return;
    if (value === "Archived") { updateDoc(doc(db, "bookings", lead.id), { status: "Archived" }).then(() => logAction("Archived lead", lead.name, lead.id)).catch(console.error); return; }
    if (stages.find((s) => s.name === value)?.isFollowUp) { setPendingFU({ stage: value, applyStatus: true }); return; }
    setPendingMove(value);
  };

  const restore = () => updateDoc(doc(db, "bookings", lead.id), { status: stages[0]?.name || "new" }).then(() => logAction("Restored lead", lead.name, lead.id)).catch(console.error);

  const created = lead.createdAt?.toDate ? lead.createdAt.toDate().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";
  const creator = lead.createdByName || (lead.source === "manual" ? "Team" : "Website form");

  return (
    <div className="fixed inset-0 z-[60] flex justify-end font-['Poppins',sans-serif]">
      <div className="absolute inset-0 bg-[#13182B]/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />

      <aside className="relative w-full max-w-[460px] h-full bg-[#FCFBF8] shadow-2xl flex flex-col" style={{ animation: "ol-slidein .28s cubic-bezier(.2,.7,.2,1)" }}>
        <style>{`@keyframes ol-slidein{from{transform:translateX(24px);opacity:.4}to{transform:translateX(0);opacity:1}}`}</style>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-[#E9E6DD] bg-white">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-xl text-white flex items-center justify-center font-bold text-[18px] shrink-0" style={{ background: archived ? "#9AA0AD" : stageColor(lead.status) }}>{(lead.name || "?").charAt(0).toUpperCase()}</div>
              <div className="min-w-0">
                <h2 className="text-[19px] font-bold text-[#13182B] leading-tight truncate">{lead.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{ background: `${stageColor(lead.status)}1a`, color: stageColor(lead.status) }}>{lead.status}</span>
                  {lead.source === "manual" && <span className="font-mono text-[10px] uppercase tracking-wider text-[#2B41E0] bg-[#EDEFFF] px-1.5 py-0.5 rounded">manual</span>}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full bg-[#F4F2EC] text-[#6B7283] hover:bg-[#E5E2D9] shrink-0"><X size={18} strokeWidth={2.5} /></button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-5 -mb-4 bg-[#F4F2EC] p-1 rounded-xl w-fit">
            {(["details", "activity"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-lg text-[13px] font-semibold capitalize transition-colors ${tab === t ? "bg-white text-[#13182B] shadow-sm" : "text-[#6B7283] hover:text-[#13182B]"}`}>
                {t === "activity" ? `Timeline${timeline.length ? ` (${timeline.length})` : ""}` : "Details"}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === "details" ? (
            <div className="space-y-5">
              {/* Stage control */}
              <div>
                <Label>Stage</Label>
                {canWrite && !archived ? (
                  <div className="flex items-center gap-2 rounded-xl border border-[#D7D3C7] bg-white pl-3 pr-1 py-2 w-fit">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: stageColor(lead.status) }} />
                    <select value={inStage ? lead.status : ""} onChange={(e) => onStageChange(e.target.value)} className="bg-transparent text-[14px] font-semibold text-[#13182B] outline-none cursor-pointer pr-1">
                      {!inStage && <option value="" disabled>{lead.status}</option>}
                      {stages.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                      <option value="Archived">Archive…</option>
                    </select>
                  </div>
                ) : (
                  <div className="text-[14px] font-semibold" style={{ color: stageColor(lead.status) }}>{lead.status}</div>
                )}
              </div>

              {/* Follow-up summary */}
              {lead.followUpDate && (
                <div className="flex items-start gap-3 bg-[#FFF6E5] border border-[#F59E0B]/30 rounded-xl p-3.5">
                  <CalendarClock size={18} className="text-[#B7791F] shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className={`font-semibold text-[13.5px] ${isOverdue(lead.followUpDate) ? "text-[#FF5C49]" : "text-[#13182B]"}`}>Follow-up {relativeDay(lead.followUpDate).toLowerCase()}</div>
                    {lead.followUpNote && <div className="text-[13px] text-[#8a6420] mt-1 flex gap-1.5"><StickyNote size={13} className="shrink-0 mt-0.5" /> {lead.followUpNote}</div>}
                  </div>
                  {canWrite && (
                    <button onClick={() => setCompleting(true)} className="shrink-0 flex items-center gap-1.5 text-[12.5px] font-semibold text-[#0F9D6B] bg-white border border-[#0F9D6B]/30 px-2.5 py-1.5 rounded-lg hover:bg-[#0F9D6B] hover:text-white transition-colors"><CheckCircle2 size={14} /> Done</button>
                  )}
                </div>
              )}

              {/* Latest stage note */}
              {lead.lastStageNote && (
                <div className="flex items-start gap-3 bg-[#F4F2EC] border border-[#E5E2D9] rounded-xl p-3.5">
                  <StickyNote size={17} className="text-[#9AA0AD] shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="font-mono text-[10.5px] text-[#9AA0AD] uppercase tracking-wider">Latest note</div>
                    <div className="text-[13.5px] text-[#3A4257] mt-0.5 leading-relaxed">{lead.lastStageNote}</div>
                  </div>
                </div>
              )}

              {/* Editable fields */}
              <div className="space-y-4">
                <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} disabled={!canWrite} icon={User} />
                <Field label="Company" value={form.company} onChange={(v) => setForm({ ...form, company: v })} disabled={!canWrite} icon={Building2} />
                <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} disabled={!canWrite} icon={Mail} />
                <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} disabled={!canWrite} icon={Phone} />
                <div>
                  <Label>Call type</Label>
                  <select value={form.callType} disabled={!canWrite} onChange={(e) => setForm({ ...form, callType: e.target.value })} className="w-full px-[14px] py-[11px] rounded-xl border border-[#D7D3C7] bg-white text-[#13182B] text-[14px] focus:border-[#2B41E0] outline-none disabled:bg-[#F7F5EF] capitalize">
                    <option value="clarity">Clarity</option>
                    <option value="technical">Technical</option>
                  </select>
                </div>
                <div>
                  <Label>What they need</Label>
                  <textarea value={form.problem} disabled={!canWrite} onChange={(e) => setForm({ ...form, problem: e.target.value })} rows={4} className="w-full px-[14px] py-[11px] rounded-xl border border-[#D7D3C7] bg-white text-[#13182B] text-[14px] focus:border-[#2B41E0] outline-none resize-none leading-relaxed disabled:bg-[#F7F5EF]" />
                </div>
              </div>

              {/* Meta */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <Meta label="Added by" value={creator} />
                <Meta label="Created" value={created} />
              </div>
            </div>
          ) : (
            <div>
              {timeline.length === 0 ? (
                <div className="text-center py-14 text-[#9AA0AD]">
                  <Clock size={28} className="mx-auto mb-3 opacity-50" />
                  <p className="text-[14px] font-medium text-[#6B7283]">No notes yet</p>
                  <p className="text-[13px]">Stage notes & follow-ups will appear here.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-2 bg-[#EDEFFF] text-[#3a4a9e] rounded-xl px-3.5 py-2.5 text-[12.5px] mb-4">
                    <Info size={15} className="shrink-0 mt-0.5" /> Notes & follow-ups recorded before this feature won't appear here.
                  </div>
                  <ul className="relative">
                    {timeline.map((n, i) => {
                      const meta = noteMeta(n);
                      return (
                        <li key={i} className="relative pl-7 pb-5 last:pb-0">
                          {i < timeline.length - 1 && <span className="absolute left-[9px] top-6 bottom-0 w-px bg-[#E5E2D9]" />}
                          <span className="absolute left-0 top-0.5 w-[19px] h-[19px] rounded-full flex items-center justify-center" style={{ background: `${meta.color}1f`, color: meta.color }}><meta.icon size={12} /></span>
                          <div className="text-[13.5px] text-[#13182B] leading-snug"><span className="font-semibold">{n.author}</span> <span className="text-[#3A4257]">{meta.label}</span></div>
                          {n.text && <div className="text-[13px] text-[#5b6472] mt-1.5 bg-[#F4F2EC] rounded-lg px-2.5 py-1.5 leading-relaxed">{n.text}</div>}
                          <div className="font-mono text-[11px] text-[#9AA0AD] mt-1">{timeAgo(n.at)}</div>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        {canWrite && tab === "details" && (
          <div className="px-6 py-4 border-t border-[#E9E6DD] bg-white flex items-center gap-3">
            <button onClick={saveDetails} disabled={saving} className="bg-[#13182B] text-white px-5 py-2.5 rounded-xl font-semibold text-[14px] flex items-center gap-2 shadow-md hover:-translate-y-0.5 transition-transform disabled:opacity-60"><Save size={16} /> {saving ? "Saving…" : "Save"}</button>
            <button onClick={() => setPendingFU({ stage: lead.status, applyStatus: false })} className="px-4 py-2.5 rounded-xl font-semibold text-[14px] text-[#B7791F] bg-[#FFF6E5] hover:bg-[#F59E0B] hover:text-white transition-colors flex items-center gap-2"><CalendarClock size={16} /> Follow-up</button>
            <div className="ml-auto">
              {archived ? (
                <button onClick={restore} title="Restore" className="w-10 h-10 flex items-center justify-center rounded-xl text-[#2B41E0] bg-[#EDEFFF] hover:bg-[#2B41E0] hover:text-white transition-colors"><RotateCcw size={17} /></button>
              ) : (
                <button onClick={() => onStageChange("Archived")} title="Archive" className="w-10 h-10 flex items-center justify-center rounded-xl text-[#9AA0AD] bg-[#F4F2EC] hover:bg-[#FF5C49] hover:text-white transition-colors"><Archive size={17} /></button>
              )}
            </div>
            {saved && <span className="text-[#0F9D6B] text-[13px] font-semibold absolute -top-7 left-6">Saved ✓</span>}
          </div>
        )}
      </aside>

      {completing && (
        <NotePromptModal
          title="Complete follow-up"
          subtitle={`How did it go with ${lead.name}?`}
          label="Outcome / notes"
          placeholder="e.g. Spoke with them — sending a proposal next week."
          confirmLabel="Mark complete"
          onCancel={() => setCompleting(false)}
          onConfirm={(outcome) => completeFollowUp(outcome)}
        />
      )}

      {pendingMove && (
        <StageNoteModal
          leadName={lead.name}
          stageName={pendingMove}
          color={stageColor(pendingMove)}
          onCancel={() => setPendingMove(null)}
          onConfirm={async (note) => {
            try { await advanceLeadStatus(lead, pendingMove, stages, note); } catch (e) { console.error(e); }
            setPendingMove(null);
          }}
        />
      )}

      {pendingFU && (
        <FollowUpModal
          leadName={lead.name}
          stageName={pendingFU.stage}
          initialDate={lead.followUpDate || new Date().toISOString().slice(0, 10)}
          initialNote={lead.followUpNote || ""}
          onCancel={() => setPendingFU(null)}
          onConfirm={async (date, note) => {
            const payload: Record<string, unknown> = { followUpDate: date, followUpNote: note, notes: arrayUnion(leadNote("followup", { stage: pendingFU.stage, date, text: note })) };
            if (pendingFU.applyStatus) payload.status = pendingFU.stage;
            try {
              await updateDoc(doc(db, "bookings", lead.id), payload);
              await logAction("Scheduled follow-up", `${lead.name} on ${date}`, lead.id);
            } catch (e) { console.error(e); }
            setPendingFU(null);
          }}
        />
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block font-mono text-[11.5px] text-[#9AA0AD] uppercase tracking-wider mb-1.5">{children}</label>;
}

function Field({ label, value, onChange, disabled, icon: Icon }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean; icon?: any }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="relative">
        {Icon && <Icon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9AA0AD]" />}
        <input value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={`w-full ${Icon ? "pl-9" : "pl-3.5"} pr-3.5 py-[11px] rounded-xl border border-[#D7D3C7] bg-white text-[#13182B] text-[14px] focus:border-[#2B41E0] outline-none disabled:bg-[#F7F5EF]`} />
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#F4F2EC] rounded-xl px-3.5 py-2.5">
      <div className="font-mono text-[10.5px] text-[#9AA0AD] uppercase tracking-wider">{label}</div>
      <div className="text-[13.5px] font-semibold text-[#13182B] mt-0.5 truncate">{value}</div>
    </div>
  );
}
