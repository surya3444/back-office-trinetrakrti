import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../lib/auth-context";
import { Loader } from "../../components/ui";
import { DynamicForm, validateForm } from "../../components/DynamicForm";
import { submitRequirements, stageProgress, type Project, type Milestone } from "../../lib/projects";
import { payMilestone, hasRazorpayKey } from "../../lib/razorpay";
import { LayoutDashboard, ClipboardList, CircleDollarSign, LogOut, Check, Clock, Loader2, X } from "lucide-react";

type Tab = "tracker" | "requirements" | "payments";

export default function ClientApp() {
  const { clientUser, signOutNow } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [missing, setMissing] = useState(false);
  const [tab, setTab] = useState<Tab>("tracker");

  // Payment flow (shared by the timeline + payments tab).
  const [payingId, setPayingId] = useState<string | null>(null);
  const [simTarget, setSimTarget] = useState<Milestone | null>(null);
  const [payErr, setPayErr] = useState("");

  useEffect(() => {
    if (!clientUser?.projectId) { setMissing(true); return; }
    const unsub = onSnapshot(doc(db, "projects", clientUser.projectId), (snap) => {
      if (snap.exists()) setProject({ id: snap.id, ...snap.data() } as Project);
      else setMissing(true);
    }, () => setMissing(true));
    return () => unsub();
  }, [clientUser?.projectId]);

  const runPay = async (m: Milestone) => {
    if (!project) return;
    setPayErr(""); setPayingId(m.id);
    try {
      const res = await payMilestone(project, m);
      if (!res.ok && res.error) setPayErr(res.error);
    } finally { setPayingId(null); setSimTarget(null); }
  };
  // Real key → open Razorpay test checkout directly; otherwise show a simulated checkout.
  const requestPay = (m: Milestone) => { setPayErr(""); if (hasRazorpayKey()) runPay(m); else setSimTarget(m); };

  if (missing) return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center font-['Inter',sans-serif] text-center p-6">
      <h1 className="text-[22px] font-black uppercase text-[#17222F] mb-2">No project linked</h1>
      <p className="text-[#5A6473] text-[15px] max-w-sm mb-6">We couldn't find a project for your account. Please contact your Trinetrakrti team.</p>
      <button onClick={signOutNow} className="flex items-center gap-2 bg-[#17222F] text-white px-5 py-2.5 font-bold uppercase tracking-wide text-[13px]"><LogOut size={16} /> Sign out</button>
    </div>
  );
  if (!project) return <div className="min-h-screen bg-white flex items-center justify-center"><Loader label="Opening your project" sub="One moment" /></div>;

  const prog = stageProgress(project.stages || []);
  const TABS: { key: Tab; label: string; icon: any }[] = [
    { key: "tracker", label: "Tracker", icon: LayoutDashboard },
    { key: "requirements", label: "Requirements", icon: ClipboardList },
    { key: "payments", label: "Payments", icon: CircleDollarSign },
  ];

  return (
    <div className="min-h-screen bg-white font-['Inter',sans-serif] text-[#17222F]">
      <header className="border-b-2 border-[#17222F] flex items-center justify-between px-4 sm:px-10 h-[64px] sm:h-[72px] sticky top-0 bg-white z-10">
        <div className="flex items-center min-w-0">
          <img src="/tot2.svg" alt="Trinetrakrti" className="h-7 sm:h-8 w-auto" />
        </div>
        <button onClick={signOutNow} className="flex items-center gap-2 font-mono text-[12px] uppercase tracking-wide text-[#5A6473] hover:text-[#E5322B] shrink-0"><LogOut size={15} /> <span className="hidden sm:inline">Sign out</span></button>
      </header>

      <main className="max-w-[1000px] mx-auto px-4 sm:px-10 py-6 sm:py-8">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-6 sm:mb-7">
          <div className="min-w-0">
            <div className="font-mono text-[11px] tracking-[0.16em] uppercase text-[#E5322B] font-semibold mb-2">Your project</div>
            <h1 className="text-[26px] sm:text-[40px] font-black uppercase tracking-tight leading-none break-words">{project.title}</h1>
            <p className="text-[13px] sm:text-[14px] text-[#5A6473] mt-2">Welcome, {clientUser?.name || clientUser?.email}. Track progress, share requirements and handle payments here.</p>
          </div>
          <div className="border-2 border-[#17222F] px-4 sm:px-5 py-2.5 sm:py-3 text-center shrink-0">
            <div className="text-[22px] sm:text-[26px] font-black text-[#E5322B] leading-none">{prog.pct}%</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#9AA0AD] mt-1.5">Complete</div>
          </div>
        </div>

        {/* Tabs — horizontally scrollable on small screens */}
        <div className="flex border-2 border-[#17222F] w-full sm:w-fit mb-7 overflow-x-auto">
          {TABS.map((t, i) => {
            const on = tab === t.key;
            return <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-2 px-4 py-2.5 text-[12.5px] font-bold uppercase tracking-[0.05em] whitespace-nowrap shrink-0 transition-colors ${i ? "border-l-2 border-[#17222F]" : ""} ${on ? "bg-[#17222F] text-white" : "bg-white hover:bg-[#F2F2F2]"}`}><t.icon size={15} /> {t.label}</button>;
          })}
        </div>

        {payErr && <div className="border-2 border-[#E5322B] bg-[#FBE9E7] text-[#E5322B] px-4 py-2.5 text-[13px] mb-5">{payErr}</div>}

        {tab === "tracker" && <Tracker project={project} payingId={payingId} onPay={requestPay} />}
        {tab === "requirements" && <ClientRequirements project={project} />}
        {tab === "payments" && <ClientPayments project={project} payingId={payingId} onPay={requestPay} />}
      </main>

      {simTarget && <SimCheckout project={project} milestone={simTarget} busy={payingId === simTarget.id} onConfirm={() => runPay(simTarget)} onClose={() => setSimTarget(null)} />}
    </div>
  );
}

// ── Tracker (timeline with payments interleaved) ─────────────────────────────
function Tracker({ project, payingId, onPay }: { project: Project; payingId: string | null; onPay: (m: Milestone) => void }) {
  const stages = project.stages || [];
  const milestones = project.paymentMilestones || [];
  const statusLabel = project.status === "completed" ? "Completed" : project.status === "on_hold" ? "On hold" : "In progress";
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 border-2 border-[#17222F] mb-7 divide-y-2 sm:divide-y-0 sm:divide-x-2 divide-[#17222F]">
        <Cell label="Status" value={statusLabel} />
        <Cell label="Current stage" value={stages.find((s) => s.id === project.currentStageId)?.name || "—"} />
        <Cell label="Target date" value={project.dueDate || "TBD"} />
      </div>

      <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#E5322B] font-bold mb-4">Project timeline</div>
      <div className="border-l-2 border-[#17222F] ml-3">
        {stages.map((s) => {
          const done = s.state === "done";
          const active = s.state === "active";
          const stageMs = milestones.filter((m) => m.stageId === s.id);
          return (
            <div key={s.id} className="relative pl-6 sm:pl-8 pb-7 last:pb-0">
              <span className={`absolute -left-[11px] top-0 w-5 h-5 border-2 border-[#17222F] flex items-center justify-center ${done ? "bg-[#0F9D6B]" : active ? "bg-[#E5322B]" : "bg-white"}`}>
                {done ? <Check size={12} className="text-white" /> : active ? <span className="w-1.5 h-1.5 bg-white" /> : null}
              </span>
              <div className={`font-bold uppercase tracking-tight text-[16px] ${active ? "text-[#E5322B]" : "text-[#17222F]"}`}>{s.name}</div>
              {s.description && <p className="text-[14px] text-[#5A6473] mt-1 max-w-lg">{s.description}</p>}
              <div className="font-mono text-[10.5px] uppercase tracking-wide mt-1.5 text-[#9AA0AD]">{done ? "Done" : active ? "In progress" : "Upcoming"}</div>
              {/* Payments tied to this stage, shown inline in the timeline */}
              {stageMs.map((m) => <InlinePayment key={m.id} m={m} paying={payingId === m.id} onPay={onPay} />)}
            </div>
          );
        })}
        {stages.length === 0 && <div className="pl-8 font-mono text-[12px] text-[#9AA0AD] uppercase">Stages will appear here soon.</div>}
      </div>
    </div>
  );
}

function InlinePayment({ m, paying, onPay }: { m: Milestone; paying: boolean; onPay: (m: Milestone) => void }) {
  const paid = m.status === "paid";
  return (
    <div className={`mt-3 border-2 ${paid ? "border-[#0F9D6B]" : "border-[#B7791F]"} bg-white p-3 flex items-center gap-3 flex-wrap max-w-lg`}>
      <CircleDollarSign size={16} className={paid ? "text-[#0F9D6B]" : "text-[#B7791F]"} />
      <div className="flex-1 min-w-0">
        <div className="font-bold text-[13.5px] uppercase tracking-tight truncate">{m.label}{m.percent != null ? ` · ${m.percent}%` : ""}</div>
        <div className="font-mono text-[11px] text-[#9AA0AD]">₹{m.amount.toLocaleString("en-IN")}</div>
      </div>
      {paid ? (
        <span className="font-bold uppercase text-[11px] tracking-wide text-[#0F9D6B] flex items-center gap-1"><Check size={13} /> Paid</span>
      ) : (
        <button onClick={() => onPay(m)} disabled={paying} className="bg-[#E5322B] text-white px-4 py-2 font-bold uppercase tracking-wide text-[11.5px] hover:bg-[#17222F] transition-colors disabled:opacity-60 flex items-center gap-1.5">
          {paying && <Loader2 size={13} className="animate-spin" />} Pay
        </button>
      )}
    </div>
  );
}

// ── Requirements (client fill) ────────────────────────────────────────────────
function ClientRequirements({ project }: { project: Project }) {
  const fields = project.requirementForm?.fields || [];
  const [values, setValues] = useState<Record<string, any>>(project.requirementResponses || {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  if (project.requirementStatus === "draft") {
    return <Notice icon={Clock} title="Nothing to fill yet" sub="Your team is still preparing the requirement form. We'll let you know when it's ready." />;
  }
  if (project.requirementStatus === "submitted") {
    const resp = project.requirementResponses || {};
    return (
      <div>
        <div className="flex items-center gap-2 font-mono text-[12px] text-[#0F9D6B] uppercase tracking-wide mb-4"><Check size={15} /> Thanks — your requirements are in.</div>
        <div className="border-2 border-[#17222F] divide-y-2 divide-[#17222F]">
          {fields.map((f) => (
            <div key={f.id} className="p-4">
              <div className="font-mono text-[11px] text-[#9AA0AD] uppercase tracking-wide mb-1">{f.label}</div>
              <div className="text-[15px] break-words">{fmt(resp[f.id])}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const submit = async () => {
    const errs = validateForm(fields, values);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try { await submitRequirements(project.id, values); } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <div className="max-w-2xl">
      <p className="text-[14px] text-[#5A6473] mb-6">Tell us what you need. The more detail, the better we can build it.</p>
      <DynamicForm fields={fields} values={values} errors={errors} onChange={(id, v) => setValues((p) => ({ ...p, [id]: v }))} />
      <button onClick={submit} disabled={saving} className="mt-7 w-full sm:w-auto bg-[#17222F] text-white px-6 py-3.5 font-bold uppercase tracking-wide text-[13px] hover:bg-[#E5322B] transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
        {saving && <Loader2 size={15} className="animate-spin" />} Submit requirements
      </button>
    </div>
  );
}

// ── Payments tab (client pay) ─────────────────────────────────────────────────
function ClientPayments({ project, payingId, onPay }: { project: Project; payingId: string | null; onPay: (m: Milestone) => void }) {
  const milestones = project.paymentMilestones || [];
  if (milestones.length === 0) return <Notice icon={CircleDollarSign} title="No payments due" sub="There are no payment milestones for your project right now." />;
  const paid = milestones.filter((m) => m.status === "paid").reduce((s, m) => s + m.amount, 0);
  const total = milestones.reduce((s, m) => s + m.amount, 0);

  return (
    <div>
      {!hasRazorpayKey() && <div className="border-2 border-[#B7791F] bg-[#FFF6E5] text-[#8A6420] px-4 py-2.5 font-mono text-[11px] uppercase tracking-wide mb-5">Demo mode — Razorpay test payments are simulated.</div>}
      <div className="grid grid-cols-2 gap-0 border-2 border-[#17222F] mb-5 divide-x-2 divide-[#17222F] w-full sm:w-fit">
        <div className="px-5 py-3 text-center"><div className="text-[18px] font-black text-[#0F9D6B]">₹{paid.toLocaleString("en-IN")}</div><div className="font-mono text-[10px] uppercase tracking-wide text-[#9AA0AD] mt-1.5">Paid</div></div>
        <div className="px-5 py-3 text-center"><div className="text-[18px] font-black text-[#17222F]">₹{total.toLocaleString("en-IN")}</div><div className="font-mono text-[10px] uppercase tracking-wide text-[#9AA0AD] mt-1.5">Total</div></div>
      </div>
      <div className="border-2 border-[#17222F] divide-y-2 divide-[#17222F]">
        {milestones.map((m) => (
          <div key={m.id} className="p-4 flex items-center gap-3 sm:gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="font-bold text-[15px] uppercase tracking-tight">{m.label}{m.percent != null ? <span className="text-[#E5322B]"> · {m.percent}%</span> : ""}</div>
              {m.paidAt && <div className="font-mono text-[11px] text-[#9AA0AD] mt-0.5">Paid {new Date(m.paidAt).toLocaleDateString()}</div>}
            </div>
            <div className="text-[20px] font-black">₹{m.amount.toLocaleString("en-IN")}</div>
            {m.status === "paid" ? (
              <span className="px-3 py-1.5 border-2 border-[#0F9D6B] bg-[#E6F6EF] text-[#0F9D6B] font-bold uppercase text-[11px] tracking-wide flex items-center gap-1.5"><Check size={13} /> Paid</span>
            ) : (
              <button onClick={() => onPay(m)} disabled={payingId === m.id} className="bg-[#E5322B] text-white px-5 py-2.5 font-bold uppercase tracking-wide text-[12.5px] hover:bg-[#17222F] transition-colors disabled:opacity-60 flex items-center gap-2">
                {payingId === m.id && <Loader2 size={14} className="animate-spin" />} Pay ₹{m.amount.toLocaleString("en-IN")}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Simulated Razorpay test checkout ──────────────────────────────────────────
function SimCheckout({ project, milestone, busy, onConfirm, onClose }: { project: Project; milestone: Milestone; busy: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-[#17222F]/50 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-sm border-t-2 sm:border-2 border-[#17222F] animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="bg-[#17222F] text-white px-5 py-4 flex items-center justify-between">
          <div className="font-black uppercase tracking-tight">Razorpay <span className="font-mono text-[11px] text-[#E5322B] tracking-widest">TEST</span></div>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-5">
          <div className="font-mono text-[11px] uppercase tracking-wide text-[#9AA0AD] mb-1">Paying Trinetrakrti</div>
          <div className="font-bold uppercase tracking-tight text-[15px]">{project.title} · {milestone.label}</div>
          <div className="text-[34px] font-black mt-3 mb-1">₹{milestone.amount.toLocaleString("en-IN")}</div>
          <div className="font-mono text-[11px] text-[#9AA0AD] mb-5">Simulated test transaction — no real money moves.</div>
          <button onClick={onConfirm} disabled={busy} className="w-full bg-[#E5322B] text-white py-3.5 font-bold uppercase tracking-wide text-[13px] hover:bg-[#17222F] transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {busy && <Loader2 size={15} className="animate-spin" />} Pay ₹{milestone.amount.toLocaleString("en-IN")}
          </button>
          <p className="font-mono text-[10.5px] text-[#9AA0AD] text-center mt-3">Secured by Razorpay (test mode)</p>
        </div>
      </div>
    </div>
  );
}

// ── bits ──────────────────────────────────────────────────────────────────
function Cell({ label, value }: { label: string; value: string }) {
  return <div className="px-5 py-4"><div className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#9AA0AD] mb-1.5">{label}</div><div className="font-bold text-[15px] uppercase tracking-tight">{value}</div></div>;
}
function Notice({ icon: Icon, title, sub }: { icon: any; title: string; sub: string }) {
  return (
    <div className="border-2 border-dashed border-[#17222F] p-8 sm:p-12 flex flex-col items-center text-center">
      <div className="w-14 h-14 border-2 border-[#17222F] flex items-center justify-center text-[#9AA0AD] mb-4"><Icon size={24} /></div>
      <h3 className="font-black uppercase text-[18px] mb-1.5">{title}</h3>
      <p className="text-[#5A6473] text-[14px] max-w-sm">{sub}</p>
    </div>
  );
}
function fmt(v: any): string {
  if (v == null || v === "") return "—";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}
