import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, orderBy, doc, updateDoc, getDoc, arrayUnion } from "firebase/firestore";
import { db } from "../lib/firebase";
import { leadNote } from "../lib/leads";
import { NotePromptModal } from "../components/NotePromptModal";
import { CalendarClock, ChevronLeft, ChevronRight, Check, Phone, Mail, Building2, CalendarDays, StickyNote } from "lucide-react";
import type { PipelineStage } from "./Settings";
import { PageHeader, Loader, EmptyState } from "../components/ui";
import { FollowUpModal } from "../components/FollowUpModal";
import { logAction } from "../lib/audit";
import { useAuth } from "../lib/auth-context";
import { todayStr, toDateStr, parseDateStr, relativeDay, isOverdue } from "../lib/dates";

interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  problem?: string;
  service?: string;
  status: string;
  followUpDate?: string | null;
  followUpNote?: string;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function FollowUps() {
  const { can } = useAuth();
  const canWrite = can("followups", "write");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [reschedule, setReschedule] = useState<Lead | null>(null);
  const [completing, setCompleting] = useState<Lead | null>(null);

  useEffect(() => {
    const q = query(collection(db, "bookings"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Lead[];
      setLeads(all.filter((l) => l.followUpDate && l.status !== "Archived"));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    getDoc(doc(db, "settings", "pipeline")).then((s) => {
      if (s.exists() && s.data().stages) setStages(s.data().stages);
    });
  }, []);

  const stageColor = (status: string) => stages.find((s) => s.name === status)?.color || "#5A6473";

  // Group follow-ups by their date string for fast calendar + list lookups.
  const byDate = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    for (const l of leads) {
      if (!l.followUpDate) continue;
      (map[l.followUpDate] ||= []).push(l);
    }
    return map;
  }, [leads]);

  const todayLeads = byDate[todayStr()] || [];
  const overdueCount = leads.filter((l) => l.followUpDate && isOverdue(l.followUpDate)).length;
  const upcomingCount = leads.filter((l) => l.followUpDate && l.followUpDate > todayStr()).length;
  const selectedLeads = byDate[selectedDate] || [];

  // Build the calendar grid for the visible month.
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const cells: (string | null)[] = [];
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(toDateStr(new Date(year, month, d)));

  const moveToDate = async (leadId: string, date: string, note?: string) => {
    try {
      const payload: Record<string, unknown> = { followUpDate: date, notes: arrayUnion(leadNote("followup", { date, text: note || "" })) };
      if (note !== undefined) payload.followUpNote = note;
      await updateDoc(doc(db, "bookings", leadId), payload);
      const lead = leads.find((l) => l.id === leadId);
      await logAction("Rescheduled follow-up", `${lead?.name || "Lead"} → ${date}`, leadId);
    } catch (e) { console.error(e); }
  };

  // Completing a follow-up captures the outcome and clears the reminder.
  const completeFollowUp = async (lead: Lead, outcome: string) => {
    try {
      await updateDoc(doc(db, "bookings", lead.id), {
        followUpDate: null,
        notes: arrayUnion(leadNote("done", { text: outcome, date: lead.followUpDate || "" })),
      });
      await logAction("Completed follow-up", `${lead.name}${outcome ? ` — “${outcome}”` : ""}`, lead.id);
    } catch (e) { console.error(e); }
  };

  const onDropDay = (e: React.DragEvent, date: string) => {
    e.preventDefault();
    if (!canWrite) return;
    const leadId = e.dataTransfer.getData("leadId");
    if (leadId) { moveToDate(leadId, date); setSelectedDate(date); }
  };

  if (loading) return <Loader label="Loading follow-ups" sub="Gathering your scheduled reminders" />;

  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="font-['Inter',sans-serif]">
      <PageHeader
        icon={CalendarClock}
        eyebrow="Lead Management"
        accent="#F59E0B"
        title="Follow-ups"
        subtitle="Every lead you've scheduled to reconnect with, on a calendar. Drag a card to a new day or open it to reschedule."
        stats={[
          { label: "Today", value: todayLeads.length, accent: "#F59E0B" },
          { label: "Overdue", value: overdueCount, accent: "#E5322B" },
          { label: "Upcoming", value: upcomingCount, accent: "#E5322B" },
        ]}
      />

      {overdueCount > 0 && (
        <div className="mb-6 flex items-center gap-3 bg-[#FBE9E7] border border-[#E5322B]/30 rounded-none px-4 py-3 animate-fade-up">
          <CalendarClock size={18} className="text-[#E5322B] shrink-0" />
          <p className="text-[14px] text-[#b23a2c]"><strong>{overdueCount}</strong> follow-up{overdueCount > 1 ? "s are" : " is"} overdue. Reschedule or close them out below.</p>
        </div>
      )}

      <div className="grid lg:grid-cols-[1.15fr_1fr] gap-6 items-start">
        {/* Calendar */}
        <div className="bg-white border border-[#17222F] rounded-none p-5 md:p-6 animate-fade-up">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[18px] font-bold text-[#17222F] flex items-center gap-2"><CalendarDays size={18} className="text-[#9AA0AD]" /> {monthLabel}</h2>
            <div className="flex items-center gap-1">
              <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="w-9 h-9 flex items-center justify-center rounded-none border border-[#17222F] text-[#5A6473] hover:bg-[#F2F2F2] transition-colors"><ChevronLeft size={18} /></button>
              <button onClick={() => { const t = new Date(); setCursor(new Date(t.getFullYear(), t.getMonth(), 1)); setSelectedDate(todayStr()); }} className="px-3 h-9 rounded-none border border-[#17222F] text-[#5A6473] text-[13px] font-semibold hover:bg-[#F2F2F2] transition-colors">Today</button>
              <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="w-9 h-9 flex items-center justify-center rounded-none border border-[#17222F] text-[#5A6473] hover:bg-[#F2F2F2] transition-colors"><ChevronRight size={18} /></button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1.5 mb-2">
            {WEEKDAYS.map((w) => <div key={w} className="text-center font-mono text-[11px] text-[#9AA0AD] uppercase tracking-wider py-1">{w}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {cells.map((date, i) => {
              if (!date) return <div key={`b${i}`} />;
              const dayLeads = byDate[date] || [];
              const isToday = date === todayStr();
              const isSelected = date === selectedDate;
              const overdue = isOverdue(date) && dayLeads.length > 0;
              const dayNum = parseDateStr(date).getDate();
              return (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => onDropDay(e, date)}
                  className={`relative aspect-square rounded-none flex flex-col items-center justify-center transition-all border ${
                    isSelected ? "border-[#17222F] bg-[#17222F] text-white" :
                    isToday ? "border-[#F59E0B] bg-[#FFF6E5] text-[#17222F]" :
                    "border-transparent hover:border-[#17222F] hover:bg-[#F2F2F2] text-[#2E3744]"
                  }`}
                >
                  <span className={`text-[14px] font-semibold ${isSelected ? "text-white" : ""}`}>{dayNum}</span>
                  {dayLeads.length > 0 && (
                    <span className={`mt-0.5 min-w-[18px] h-[18px] px-1 rounded-none text-[10px] font-bold flex items-center justify-center ${
                      isSelected ? "bg-white/25 text-white" : overdue ? "bg-[#E5322B] text-white" : "bg-[#F59E0B] text-white"
                    }`}>{dayLeads.length}</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-4 mt-5 pt-4 border-t border-[#17222F] flex-wrap">
            <Legend color="#F59E0B" label="Scheduled" />
            <Legend color="#E5322B" label="Overdue" />
            <span className="font-mono text-[11px] text-[#9AA0AD]">Tip: drag a lead onto a day to reschedule</span>
          </div>
        </div>

        {/* Selected day list */}
        <div className="animate-fade-up">
          <div className="flex items-end justify-between mb-4">
            <div>
              <div className="font-mono text-[11px] text-[#F59E0B] uppercase tracking-[0.14em] font-semibold mb-1">{relativeDay(selectedDate)}</div>
              <h2 className="text-[20px] font-bold text-[#17222F] leading-none">{parseDateStr(selectedDate).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</h2>
            </div>
            <span className="font-mono text-[12px] text-[#5A6473] bg-white border border-[#17222F] px-3 py-1.5 rounded-none">{selectedLeads.length} lead{selectedLeads.length !== 1 ? "s" : ""}</span>
          </div>

          <div className="space-y-3">
            {selectedLeads.map((lead) => {
              const overdue = isOverdue(lead.followUpDate!);
              const color = stageColor(lead.status);
              return (
                <div
                  key={lead.id}
                  draggable={canWrite}
                  onDragStart={(e) => e.dataTransfer.setData("leadId", lead.id)}
                  className={`bg-white border border-[#17222F] rounded-none p-5 hover: transition-all animate-fade-in ${canWrite ? "cursor-grab active:cursor-grabbing" : ""}`}
                  style={{ borderLeft: `4px solid ${color}` }}
                >
                  <div className="flex justify-between items-start gap-3 mb-3">
                    <div>
                      <h3 className="font-bold text-[#17222F] text-[17px] leading-tight">{lead.name}</h3>
                      {lead.company && lead.company !== "N/A" && (
                        <p className="text-[#5A6473] text-[13px] flex items-center gap-1.5 mt-1"><Building2 size={13} /> {lead.company}</p>
                      )}
                    </div>
                    <span className="font-mono text-[10px] px-2 py-1 rounded-none uppercase tracking-wider font-semibold shrink-0" style={{ background: `${color}1a`, color }}>{lead.status}</span>
                  </div>

                  {lead.problem && <p className="text-[#5A6473] text-[13px] line-clamp-2 leading-relaxed mb-3 border-t border-[#17222F] pt-3">{lead.problem}</p>}

                  {lead.followUpNote && (
                    <div className="flex gap-2 text-[12.5px] text-[#8a6420] bg-[#FFF6E5] border border-[#F59E0B]/25 rounded-none px-2.5 py-2 leading-relaxed mb-3">
                      <StickyNote size={13} className="shrink-0 mt-0.5" /> <span>{lead.followUpNote}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-[#5A6473] mb-4">
                    <span className="flex items-center gap-1.5"><Mail size={13} className="text-[#9AA0AD]" /> {lead.email}</span>
                    {lead.phone && lead.phone !== "N/A" && <span className="flex items-center gap-1.5"><Phone size={13} className="text-[#9AA0AD]" /> {lead.phone}</span>}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className={`font-mono text-[11px] px-2.5 py-1.5 rounded-none font-semibold flex items-center gap-1.5 ${overdue ? "bg-[#FBE9E7] text-[#E5322B]" : "bg-[#FFF6E5] text-[#B7791F]"}`}>
                      <CalendarClock size={12} /> {relativeDay(lead.followUpDate!)}
                    </span>
                    {canWrite && (
                      <div className="flex gap-2">
                        <button onClick={() => setReschedule(lead)} className="text-[13px] font-semibold text-[#E5322B] bg-[#F2F2F2] px-3 py-2 rounded-none hover:bg-[#E5322B] hover:text-white transition-colors">Reschedule</button>
                        <button onClick={() => setCompleting(lead)} className="text-[13px] font-semibold text-[#0F9D6B] bg-[#E6F6EF] px-3 py-2 rounded-none hover:bg-[#0F9D6B] hover:text-white transition-colors flex items-center gap-1.5"><Check size={14} /> Done</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {selectedLeads.length === 0 && (
              <EmptyState icon={CalendarClock} title="Nothing scheduled" sub={`No follow-ups for ${relativeDay(selectedDate).toLowerCase()}. Pick another day, or drag a lead here from another date.`} />
            )}
          </div>
        </div>
      </div>

      {/* Complete follow-up — capture the outcome */}
      {completing && (
        <NotePromptModal
          title="Complete follow-up"
          subtitle={`How did it go with ${completing.name}?`}
          label="Outcome / notes"
          placeholder="e.g. Spoke with them — sending a proposal next week."
          confirmLabel="Mark complete"
          onCancel={() => setCompleting(null)}
          onConfirm={async (outcome) => { await completeFollowUp(completing, outcome); setCompleting(null); }}
        />
      )}

      {/* Reschedule modal (shared — captures date + remarks) */}
      {reschedule && (
        <FollowUpModal
          leadName={reschedule.name}
          stageName={reschedule.status}
          initialDate={reschedule.followUpDate || todayStr()}
          initialNote={reschedule.followUpNote || ""}
          confirmLabel="Save date"
          onCancel={() => setReschedule(null)}
          onConfirm={async (date, note) => {
            await moveToDate(reschedule.id, date, note);
            setSelectedDate(date);
            setReschedule(null);
          }}
        />
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 font-mono text-[11px] text-[#5A6473]">
      <span className="w-2.5 h-2.5 rounded-none" style={{ background: color }} /> {label}
    </span>
  );
}
