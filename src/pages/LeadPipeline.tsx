import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { UserCheck, CalendarClock, Layers, X, Plus, StickyNote } from "lucide-react";
import type { PipelineStage } from "./Settings";
import { PageHeader, Loader, EmptyState } from "../components/ui";
import { FollowUpModal } from "../components/FollowUpModal";
import { advanceLeadStatus } from "../lib/leads";
import { useAuth } from "../lib/auth-context";
import { todayStr, addDaysStr, relativeDay, isOverdue } from "../lib/dates";

const BLANK_LEAD = { name: "", email: "", phone: "", company: "", problem: "", callType: "clarity", stage: "" };

export default function LeadPipeline() {
  const { can } = useAuth();
  const canWrite = can("pipeline", "write");
  const [leads, setLeads] = useState<any[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);

  // Pending follow-up: a lead dropped into a follow-up stage, awaiting a date/remarks.
  const [followUp, setFollowUp] = useState<{ leadId: string; stage: string } | null>(null);

  // Manual lead creation
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(BLANK_LEAD);
  const [saving, setSaving] = useState(false);

  // 1. Fetch dynamic stages from settings
  useEffect(() => {
    async function fetchStages() {
      const docSnap = await getDoc(doc(db, "settings", "pipeline"));
      if (docSnap.exists() && docSnap.data().stages) {
        setStages(docSnap.data().stages);
      } else {
        setStages([
          { id: "1", name: "Qualified", color: "#2B41E0" },
          { id: "2", name: "Contacted", color: "#FF5C49" },
          { id: "3", name: "Follow Up", color: "#F59E0B", isFollowUp: true },
          { id: "4", name: "Proposal", color: "#8B5CF6" },
          { id: "5", name: "Converted", color: "#0F9D6B" },
        ]);
      }
    }
    fetchStages();
  }, []);

  // 2. Fetch Leads
  useEffect(() => {
    const q = query(collection(db, "bookings"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLeads(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData("leadId", leadId);
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleDrop = async (e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData("leadId");
    if (!leadId) return;

    const lead = leads.find(l => l.id === leadId);
    if (!lead || lead.status === targetStage) return;

    // Dropping into a follow-up stage asks for a date + remarks first.
    if (stages.find(s => s.name === targetStage)?.isFollowUp) {
      setFollowUp({ leadId, stage: targetStage });
      return;
    }

    try {
      await advanceLeadStatus(lead, targetStage, stages);
    } catch (error) { console.error(error); }
  };

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const stage = form.stage || stages[0]?.name;
    const stageObj = stages.find(s => s.name === stage);
    try {
      await addDoc(collection(db, "bookings"), {
        name: form.name,
        email: form.email,
        phone: form.phone || "N/A",
        company: form.company || "N/A",
        problem: form.problem,
        callType: form.callType,
        stage: "Added manually",
        status: stage,
        source: "manual",
        // Seed a follow-up reminder when added straight into a follow-up stage.
        followUpDate: stageObj?.isFollowUp ? addDaysStr(todayStr(), 1) : null,
        createdAt: serverTimestamp(),
      });
      setShowAdd(false);
      setForm(BLANK_LEAD);
    } catch (error) { console.error(error); }
    finally { setSaving(false); }
  };

  if (loading || stages.length === 0) return <Loader label="Loading pipeline" sub="Arranging your sales board" />;

  const activeStatuses = new Set(stages.map(s => s.name));
  const inPipeline = leads.filter(l => activeStatuses.has(l.status)).length;
  const followUpCount = leads.filter(l => l.followUpDate && stages.find(s => s.name === l.status)?.isFollowUp).length;
  const followUpLead = followUp ? leads.find(l => l.id === followUp.leadId) : null;

  return (
    <div className="font-['Poppins',sans-serif] h-full flex flex-col relative">
      <PageHeader
        icon={Layers}
        eyebrow="Lead Management"
        accent="#2B41E0"
        title="Lead Pipeline"
        subtitle="Drag leads across stages as they progress. Drop into a follow-up stage to schedule a reminder, or into the final stage to convert them into a client."
        stats={[
          { label: "In pipeline", value: inPipeline, accent: "#2B41E0" },
          { label: "Follow-ups", value: followUpCount, accent: "#F59E0B" },
        ]}
        actions={canWrite && (
          <button onClick={() => { setForm({ ...BLANK_LEAD, stage: stages[0]?.name || "" }); setShowAdd(true); }} className="bg-[#13182B] text-white px-5 py-2.5 rounded-xl font-semibold text-[14.5px] flex items-center gap-2 hover:-translate-y-0.5 transition-transform shadow-md justify-center">
            <Plus size={18} /> Add Lead
          </button>
        )}
      />

      {!canWrite && (
        <div className="mb-4 -mt-2 font-mono text-[12px] text-[#9AA0AD]">Read-only view — you can browse the board but not move leads.</div>
      )}

      <div className="flex gap-5 overflow-x-auto pb-4 flex-1">
        {stages.map((stageObj, stageIndex) => {
          const stage = stageObj.name;
          const color = stageObj.color;
          const columnLeads = leads.filter((l) => l.status === stage);
          const isFinalStage = stageIndex === stages.length - 1;

          return (
            <div key={stage} className="min-w-[300px] w-[300px] flex flex-col"
              onDragOver={canWrite ? handleDragOver : undefined}
              onDrop={canWrite ? (e) => handleDrop(e, stage) : undefined}>

              {/* Column header */}
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <span className="font-semibold text-[14.5px] text-[#13182B]">{stage}</span>
                  {stageObj.isFollowUp && <CalendarClock size={13} className="text-[#9AA0AD]" />}
                  {isFinalStage && <UserCheck size={13} className="text-[#9AA0AD]" />}
                </div>
                <span className="font-mono text-[11px] text-[#6B7283] bg-[#EFEDE5] px-2 py-0.5 rounded-full">{columnLeads.length}</span>
              </div>

              {/* Column body */}
              <div className="bg-[#F7F5EF] rounded-2xl p-2.5 flex-1 flex flex-col gap-2.5 min-h-[460px]" style={{ boxShadow: `inset 0 2.5px 0 ${color}` }}>
                {columnLeads.map((lead) => {
                  const overdue = lead.followUpDate && isOverdue(lead.followUpDate);
                  return (
                    <div key={lead.id} draggable={canWrite} onDragStart={(e) => handleDragStart(e, lead.id)}
                      className={`bg-white border border-[#EAE7DE] rounded-xl p-3.5 shadow-[0_1px_2px_rgba(19,24,43,0.04)] hover:shadow-[0_6px_16px_-8px_rgba(19,24,43,0.22)] hover:border-[#D7D3C7] transition-all animate-fade-in ${canWrite ? "cursor-grab active:cursor-grabbing" : ""}`}>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-semibold text-[#13182B] text-[14.5px] leading-snug">{lead.name}</h4>
                        {lead.source === "manual" && <span className="font-mono text-[9px] uppercase tracking-wider text-[#2B41E0] bg-[#EDEFFF] px-1.5 py-0.5 rounded shrink-0 mt-0.5">manual</span>}
                      </div>
                      <p className="text-[#6B7283] text-[12.5px] mt-0.5 truncate">{lead.company && lead.company !== "N/A" ? lead.company : lead.email}</p>

                      <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#9AA0AD]">{lead.callType}</span>
                        {stageObj.isFollowUp && lead.followUpDate && (
                          <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded font-semibold inline-flex items-center gap-1 ${overdue ? "bg-[#FFEDE9] text-[#FF5C49]" : "bg-[#FFF6E5] text-[#B7791F]"}`}>
                            <CalendarClock size={10} /> {relativeDay(lead.followUpDate)}
                          </span>
                        )}
                      </div>

                      {stageObj.isFollowUp && lead.followUpNote && (
                        <div className="mt-2.5 flex gap-1.5 text-[12px] text-[#8a6420] bg-[#FFFaf0] rounded-md px-2 py-1.5 leading-relaxed">
                          <StickyNote size={12} className="shrink-0 mt-0.5" /> <span className="line-clamp-2">{lead.followUpNote}</span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {columnLeads.length === 0 && (
                  <div className="flex-1 flex items-center justify-center text-[#C4C0B4] text-[12.5px] font-medium py-10">
                    {canWrite ? "Drop leads here" : "No leads"}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {leads.filter(l => activeStatuses.has(l.status)).length === 0 && (
        <div className="mt-4">
          <EmptyState icon={Layers} title="Your pipeline is empty" sub="Approve leads from the Leads triage screen, or add one directly with the Add Lead button." />
        </div>
      )}

      {/* Follow-up date + remarks prompt */}
      {followUp && (
        <FollowUpModal
          leadName={followUpLead?.name || "Lead"}
          stageName={followUp.stage}
          initialDate={followUpLead?.followUpDate || addDaysStr(todayStr(), 1)}
          initialNote={followUpLead?.followUpNote || ""}
          onCancel={() => setFollowUp(null)}
          onConfirm={async (date, note) => {
            try {
              await updateDoc(doc(db, "bookings", followUp.leadId), { status: followUp.stage, followUpDate: date, followUpNote: note });
            } catch (error) { console.error(error); }
            setFollowUp(null);
          }}
        />
      )}

      {/* Add lead manually */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#13182B] bg-opacity-40 backdrop-blur-sm overflow-y-auto animate-fade-in">
          <form onSubmit={handleAddLead} className="bg-white w-full max-w-lg border border-[#D7D3C7] rounded-[24px] shadow-2xl overflow-hidden my-8 animate-scale-in">
            <div className="px-6 py-5 border-b border-[#E5E2D9] flex justify-between items-center bg-[#FCFBF8]">
              <div>
                <div className="font-mono text-[11px] text-[#2B41E0] uppercase font-semibold mb-1">New lead</div>
                <h2 className="text-[20px] font-bold text-[#13182B] leading-none">Add to pipeline</h2>
              </div>
              <button type="button" onClick={() => setShowAdd(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#E5E2D9] text-[#6B7283] hover:bg-[#D7D3C7]"><X size={16} strokeWidth={2.5} /></button>
            </div>

            <div className="p-6 md:p-7 space-y-5 max-h-[70vh] overflow-y-auto">
              <div className="grid sm:grid-cols-2 gap-5">
                <Field label="Name" required value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
                <Field label="Company" value={form.company} onChange={(v) => setForm({ ...form, company: v })} />
                <Field label="Email" type="email" required value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
                <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
              </div>

              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="block font-mono text-[12px] text-[#6B7283] mb-[7px]">Call type</label>
                  <select value={form.callType} onChange={(e) => setForm({ ...form, callType: e.target.value })} className="w-full px-[14px] py-[13px] rounded-xl border border-[#D7D3C7] bg-[#FCFBF8] text-[#13182B] focus:border-[#2B41E0] outline-none appearance-none">
                    <option value="clarity">Clarity</option>
                    <option value="technical">Technical</option>
                  </select>
                </div>
                <div>
                  <label className="block font-mono text-[12px] text-[#6B7283] mb-[7px]">Start in stage</label>
                  <select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })} className="w-full px-[14px] py-[13px] rounded-xl border border-[#D7D3C7] bg-[#FCFBF8] text-[#13182B] focus:border-[#2B41E0] outline-none appearance-none">
                    {stages.map((s) => <option key={s.id} value={s.name}>{s.name}{s.isFollowUp ? " (follow-up)" : ""}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-mono text-[12px] text-[#6B7283] mb-[7px]">What do they need?</label>
                <textarea value={form.problem} onChange={(e) => setForm({ ...form, problem: e.target.value })} rows={3} className="w-full px-[14px] py-[11px] rounded-xl border border-[#D7D3C7] bg-[#FCFBF8] text-[#13182B] text-[14px] focus:border-[#2B41E0] outline-none resize-none leading-relaxed" />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#E5E2D9] bg-[#FCFBF8] flex gap-3 justify-end">
              <button type="button" onClick={() => setShowAdd(false)} className="px-5 py-2.5 rounded-xl font-semibold text-[14px] text-[#6B7283] bg-[#F4F2EC] hover:bg-[#E5E2D9] transition-colors">Cancel</button>
              <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-xl font-semibold text-[14px] text-white bg-[#13182B] hover:-translate-y-0.5 transition-transform shadow-md disabled:opacity-70 flex items-center gap-2"><Plus size={16} /> {saving ? "Adding…" : "Add lead"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div>
      <label className="block font-mono text-[12px] text-[#6B7283] mb-[7px]">{label}{required && <span className="text-[#FF5C49]"> *</span>}</label>
      <input type={type} required={required} value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-[14px] py-[13px] rounded-xl border border-[#D7D3C7] bg-[#FCFBF8] text-[#13182B] focus:border-[#2B41E0] outline-none" />
    </div>
  );
}
