import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut } from "firebase/auth";
import { doc, onSnapshot, setDoc, collection, query, orderBy, serverTimestamp } from "firebase/firestore";
import { db, auth, firebaseConfig } from "../lib/firebase";
import {
  ArrowLeft, Layers, ClipboardList, Users, CircleDollarSign, Info, Plus, Trash2, X,
  ArrowUp, ArrowDown, Check, Mail, Copy, Send, Link2,
} from "lucide-react";
import { Loader } from "../components/ui";
import { useAuth } from "../lib/auth-context";
import { logAction } from "../lib/audit";
import type { Member } from "../lib/permissions";
import {
  updateProject, saveStages, setStageState, saveMilestones, recordPayment,
  saveRequirementForm, sendRequirementForm, stageProgress, genId, amountFromPercent,
  FIELD_TYPES, type Project, type Stage, type Milestone, type Field, type ProjectStatus, type FieldType,
} from "../lib/projects";

type Tab = "overview" | "stages" | "requirements" | "members" | "payments";
const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: "overview", label: "Overview", icon: Info },
  { key: "stages", label: "Stages", icon: Layers },
  { key: "requirements", label: "Requirements", icon: ClipboardList },
  { key: "members", label: "Members", icon: Users },
  { key: "payments", label: "Payments", icon: CircleDollarSign },
];

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can, member } = useAuth();
  const canManage = can("projects", "write");
  const fullRead = can("projects", "read");
  const [project, setProject] = useState<Project | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, "projects", id), (snap) => {
      if (snap.exists()) setProject({ id: snap.id, ...snap.data() } as Project);
      else setNotFound(true);
    });
    return () => unsub();
  }, [id]);

  if (notFound) return (
    <div className="font-['Inter',sans-serif] py-20 text-center">
      <h2 className="text-[20px] font-black uppercase text-[#17222F] mb-2">Project not found</h2>
      <button onClick={() => navigate("/projects")} className="font-mono text-[13px] text-[#E5322B] uppercase tracking-wide">← Back to projects</button>
    </div>
  );
  if (!project) return <Loader label="Loading project" sub="Opening the build" />;

  // Access: full 'projects' role, or a member assigned to THIS project (scoped).
  const assigned = (project.members || []).includes(member?.uid || "");
  if (!fullRead && !assigned) return (
    <div className="font-['Inter',sans-serif] py-20 text-center">
      <h2 className="text-[20px] font-black uppercase text-[#17222F] mb-2">No access to this project</h2>
      <p className="text-[#5A6473] text-[14px] mb-4 max-w-sm mx-auto">You're not assigned to this project. Ask a manager to add you.</p>
      <button onClick={() => navigate("/projects")} className="font-mono text-[13px] text-[#E5322B] uppercase tracking-wide">← Back to projects</button>
    </div>
  );
  const assigneeOnly = !fullRead && assigned;  // can only mark stage states
  const canMarkStages = canManage || assigned;
  const visibleTabs = assigneeOnly ? TABS.filter((t) => t.key === "overview" || t.key === "stages") : TABS;

  const prog = stageProgress(project.stages || []);

  return (
    <div className="font-['Inter',sans-serif]">
      <button onClick={() => navigate("/projects")} className="flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.1em] text-[#5A6473] hover:text-[#E5322B] mb-5">
        <ArrowLeft size={15} /> Projects
      </button>

      <div className="flex items-start justify-between gap-5 flex-wrap mb-6">
        <div className="min-w-0">
          <div className="font-mono text-[11px] tracking-[0.16em] uppercase text-[#E5322B] font-semibold mb-2">{project.clientName}</div>
          <h1 className="text-[28px] md:text-[34px] font-black text-[#17222F] leading-none tracking-tight uppercase">{project.title}</h1>
        </div>
        <div className="border-2 border-[#17222F] bg-white px-4 py-2.5 text-center min-w-[120px]">
          <div className="text-[22px] font-black text-[#E5322B] leading-none">{prog.pct}%</div>
          <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#9AA0AD] mt-1.5">{prog.done}/{prog.total} stages</div>
        </div>
      </div>

      {assigneeOnly && <div className="mb-4 font-mono text-[11px] uppercase tracking-wide text-[#5A6473] border-2 border-[#17222F] bg-[#F2F2F2] px-3 py-2 inline-block">Assignee view — you can update stage progress.</div>}

      {/* Tabs */}
      <div className="flex flex-wrap gap-0 border-2 border-[#17222F] w-fit mb-7">
        {visibleTabs.map((t, i) => {
          const on = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-2 px-4 py-2.5 text-[12.5px] font-bold uppercase tracking-[0.05em] transition-colors ${i ? "border-l-2 border-[#17222F]" : ""} ${on ? "bg-[#17222F] text-white" : "bg-white text-[#17222F] hover:bg-[#F2F2F2]"}`}>
              <t.icon size={15} /> <span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>

      {tab === "overview" && <Overview project={project} canWrite={canManage} />}
      {tab === "stages" && <Stages project={project} canWrite={canManage} canMark={canMarkStages} />}
      {tab === "requirements" && !assigneeOnly && <Requirements project={project} canWrite={canManage} />}
      {tab === "members" && !assigneeOnly && <MembersTab project={project} canWrite={canManage} />}
      {tab === "payments" && !assigneeOnly && <Payments project={project} canWrite={canManage} />}
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────
function Overview({ project, canWrite }: { project: Project; canWrite: boolean }) {
  const { user } = useAuth();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const portalUrl = window.location.origin;

  const setStatus = (status: ProjectStatus) => canWrite && updateProject(project.id, { status });
  const setDue = (dueDate: string) => canWrite && updateProject(project.id, { dueDate });

  const inviteClient = async (email: string, password: string) => {
    setErr(""); setMsg(""); setInviting(true);
    const secondary = initializeApp(firebaseConfig, `client-${Date.now()}`);
    const secAuth = getAuth(secondary);
    try {
      const cred = await createUserWithEmailAndPassword(secAuth, email.trim(), password);
      const uid = cred.user.uid;
      await signOut(secAuth);
      await setDoc(doc(db, "clientUsers", uid), {
        uid, email: email.trim(), name: project.clientName, projectId: project.id, disabled: false, createdAt: serverTimestamp(),
      });
      await updateProject(project.id, { clientUid: uid, clientEmail: email.trim() });
      try { await sendPasswordResetEmail(auth, email.trim()); } catch { /* non-fatal */ }
      await logAction("Invited client", `${email.trim()} → ${project.title}`, project.id);
      setMsg(`${email.trim()} can now sign in at the portal. A password-set email was sent.`);
      setInviteOpen(false);
    } catch (e: any) {
      setErr(e?.code === "auth/email-already-in-use" ? "That email already has an account." : e?.message || "Could not invite client.");
    } finally {
      try { await deleteApp(secondary); } catch { /* ignore */ }
      setInviting(false);
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-5">
      <Panel title="Client & access">
        <Row label="Client" value={project.clientName} />
        <Row label="Email" value={project.clientEmail || "—"} />
        <div className="pt-3 mt-3 border-t-2 border-[#17222F]">
          {project.clientUid ? (
            <div>
              <div className="flex items-center gap-2 font-mono text-[12px] text-[#0F9D6B] uppercase tracking-wide mb-2"><Check size={14} /> Portal access active</div>
              <div className="flex items-center gap-2 border-2 border-[#17222F] px-3 py-2">
                <Link2 size={14} className="text-[#5A6473]" />
                <span className="font-mono text-[12px] text-[#17222F] truncate flex-1">{portalUrl}</span>
                <button onClick={() => { navigator.clipboard?.writeText(portalUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="text-[#5A6473] hover:text-[#E5322B]">{copied ? <Check size={15} /> : <Copy size={15} />}</button>
              </div>
              <p className="font-mono text-[11px] text-[#9AA0AD] mt-2">Client signs in with {project.clientEmail}.</p>
            </div>
          ) : (
            <>
              <p className="text-[13px] text-[#5A6473] mb-3">No portal login yet. Invite the client so they can track progress, fill requirements and pay.</p>
              {canWrite && <button onClick={() => { setInviteOpen(true); setErr(""); }} className="bg-[#17222F] text-white px-4 py-2.5 font-bold uppercase tracking-wide text-[12.5px] flex items-center gap-2 hover:bg-[#E5322B] transition-colors"><Mail size={15} /> Invite client</button>}
            </>
          )}
          {msg && <p className="font-mono text-[11px] text-[#0F9D6B] mt-3">{msg}</p>}
        </div>
      </Panel>

      <Panel title="Status & timeline">
        <label className="block font-mono text-[12px] text-[#17222F] uppercase tracking-[0.08em] mb-[7px]">Status</label>
        <select disabled={!canWrite} value={project.status} onChange={(e) => setStatus(e.target.value as ProjectStatus)} className={inputCls}>
          <option value="active">Active</option>
          <option value="on_hold">On hold</option>
          <option value="completed">Completed</option>
        </select>
        <label className="block font-mono text-[12px] text-[#17222F] uppercase tracking-[0.08em] mb-[7px] mt-4">Due date</label>
        <input type="date" disabled={!canWrite} value={project.dueDate || ""} onChange={(e) => setDue(e.target.value)} className={inputCls} />
        <div className="pt-3 mt-4 border-t-2 border-[#17222F] grid grid-cols-2 gap-3 font-mono text-[12px]">
          <div><div className="text-[#9AA0AD] uppercase text-[10px] tracking-wide">Requirements</div><div className="text-[#17222F] mt-1">{project.requirementStatus}</div></div>
          <div><div className="text-[#9AA0AD] uppercase text-[10px] tracking-wide">Members</div><div className="text-[#17222F] mt-1">{(project.members || []).length}</div></div>
        </div>
      </Panel>

      {inviteOpen && <InviteModal clientName={project.clientName} defaultEmail={project.clientEmail || ""} inviting={inviting} error={err} onClose={() => setInviteOpen(false)} onInvite={inviteClient} createdBy={user?.uid} />}
    </div>
  );
}

function InviteModal({ clientName, defaultEmail, inviting, error, onClose, onInvite }: { clientName: string; defaultEmail: string; inviting: boolean; error: string; onClose: () => void; onInvite: (email: string, pw: string) => void; createdBy?: string }) {
  const [email, setEmail] = useState(defaultEmail);
  const [pw, setPw] = useState(() => `Tk-${Math.random().toString(36).slice(2, 10)}`);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#17222F]/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white w-full max-w-md border-2 border-[#17222F] animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="px-7 py-5 border-b-2 border-[#17222F] flex justify-between items-center">
          <h2 className="text-[20px] font-black uppercase text-[#17222F]">Invite {clientName}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-[#F2F2F2] hover:bg-[#17222F] hover:text-white"><X size={16} strokeWidth={2.5} /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onInvite(email, pw); }} className="p-7 flex flex-col gap-4">
          <div><label className="block font-mono text-[12px] text-[#17222F] uppercase tracking-wide mb-[7px]">Client email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@company.com" className={inputCls} /></div>
          <div><label className="block font-mono text-[12px] text-[#17222F] uppercase tracking-wide mb-[7px]">Temporary password</label>
            <input required value={pw} onChange={(e) => setPw(e.target.value)} className={inputCls} />
            <p className="font-mono text-[11px] text-[#9AA0AD] mt-1.5">They'll get an email to set their own password.</p></div>
          {error && <p className="font-mono text-[12px] text-[#E5322B]">{error}</p>}
          <button type="submit" disabled={inviting} className="bg-[#17222F] text-white py-[14px] font-bold uppercase tracking-wide text-[13px] hover:bg-[#E5322B] transition-colors disabled:opacity-60">{inviting ? "Inviting…" : "Create portal login"}</button>
        </form>
      </div>
    </div>
  );
}

// ── Stages ────────────────────────────────────────────────────────────────
function Stages({ project, canWrite, canMark }: { project: Project; canWrite: boolean; canMark: boolean }) {
  const [stages, setStages] = useState<Stage[]>(project.stages || []);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { if (!dirty) setStages(project.stages || []); }, [project.stages, dirty]);

  const mutate = (next: Stage[]) => { setStages(next); setDirty(true); };
  const edit = (sid: string, patch: Partial<Stage>) => mutate(stages.map((s) => s.id === sid ? { ...s, ...patch } : s));
  const add = () => mutate([...stages, { id: genId(), name: "New stage", description: "", state: "pending" }]);
  const remove = (sid: string) => mutate(stages.filter((s) => s.id !== sid));
  const move = (i: number, d: number) => { const n = [...stages]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; mutate(n); };
  const save = async () => { await saveStages(project.id, stages); setDirty(false); };

  const quickState = (s: Stage, state: Stage["state"]) => canMark && setStageState({ ...project, stages }, s.id, state);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[14px] text-[#5A6473] max-w-xl">Define the stages this project moves through. The client sees this as a live tracker.</p>
        {canWrite && dirty && <button onClick={save} className="bg-[#E5322B] text-white px-4 py-2 font-bold uppercase tracking-wide text-[12px] flex items-center gap-2"><Check size={14} /> Save order & names</button>}
      </div>
      <div className="border-2 border-[#17222F] divide-y-2 divide-[#17222F]">
        {stages.map((s, i) => (
          <div key={s.id} className="p-4 flex items-start gap-3" style={{ background: s.state === "active" ? "#FBE9E7" : s.state === "done" ? "#E6F6EF" : "#fff" }}>
            <div className="flex flex-col gap-1 pt-1">
              <button disabled={!canWrite} onClick={() => move(i, -1)} className="text-[#9AA0AD] hover:text-[#17222F] disabled:opacity-30"><ArrowUp size={14} /></button>
              <button disabled={!canWrite} onClick={() => move(i, 1)} className="text-[#9AA0AD] hover:text-[#17222F] disabled:opacity-30"><ArrowDown size={14} /></button>
            </div>
            <span className="font-mono text-[12px] text-[#E5322B] font-bold pt-2.5 w-6">{String(i + 1).padStart(2, "0")}</span>
            <div className="flex-1 min-w-0">
              <input disabled={!canWrite} value={s.name} onChange={(e) => edit(s.id, { name: e.target.value })} className="w-full font-bold text-[15px] text-[#17222F] uppercase tracking-tight bg-transparent border-b-2 border-transparent focus:border-[#17222F] outline-none" />
              <input disabled={!canWrite} value={s.description || ""} placeholder="Short description (optional)" onChange={(e) => edit(s.id, { description: e.target.value })} className="w-full text-[13px] text-[#5A6473] bg-transparent outline-none mt-1" />
              <div className="flex gap-1.5 mt-3">
                {(["pending", "active", "done"] as const).map((st) => (
                  <button key={st} disabled={!canMark} onClick={() => quickState(s, st)} className={`px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide border-2 transition-colors ${s.state === st ? "bg-[#17222F] text-white border-[#17222F]" : "bg-white text-[#5A6473] border-[#17222F] hover:bg-[#F2F2F2]"} disabled:opacity-50`}>{st}</button>
                ))}
              </div>
              {(() => {
                const ms = (project.paymentMilestones || []).filter((m) => m.stageId === s.id);
                if (ms.length === 0) return null;
                return (
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {ms.map((m) => (
                      <span key={m.id} className={`inline-flex items-center gap-1.5 px-2 py-1 text-[10.5px] font-bold uppercase tracking-wide border-2 ${m.status === "paid" ? "border-[#0F9D6B] bg-[#E6F6EF] text-[#0F9D6B]" : "border-[#B7791F] bg-[#FFF6E5] text-[#B7791F]"}`}>
                        <CircleDollarSign size={12} /> {m.label} · ₹{m.amount.toLocaleString("en-IN")} · {m.status === "paid" ? "Paid" : "Due"}
                      </span>
                    ))}
                  </div>
                );
              })()}
            </div>
            {canWrite && <button onClick={() => remove(s.id)} className="text-[#9AA0AD] hover:text-[#E5322B]"><Trash2 size={16} /></button>}
          </div>
        ))}
      </div>
      {canWrite && <button onClick={add} className="mt-4 flex items-center gap-2 border-2 border-[#17222F] px-4 py-2.5 font-bold uppercase tracking-wide text-[12.5px] hover:bg-[#17222F] hover:text-white transition-colors"><Plus size={15} /> Add stage</button>}
    </div>
  );
}

// ── Requirements (builder + responses) ──────────────────────────────────────
function Requirements({ project, canWrite }: { project: Project; canWrite: boolean }) {
  const [fields, setFields] = useState<Field[]>(project.requirementForm?.fields || []);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { if (!dirty) setFields(project.requirementForm?.fields || []); }, [project.requirementForm, dirty]);

  const mutate = (n: Field[]) => { setFields(n); setDirty(true); };
  const edit = (fid: string, patch: Partial<Field>) => mutate(fields.map((f) => f.id === fid ? { ...f, ...patch } : f));
  const add = () => mutate([...fields, { id: genId(), label: "New question", type: "text", required: false }]);
  const remove = (fid: string) => mutate(fields.filter((f) => f.id !== fid));
  const move = (i: number, d: number) => { const n = [...fields]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; mutate(n); };
  const save = async () => { await saveRequirementForm(project.id, { fields }); setDirty(false); };

  if (project.requirementStatus === "submitted") {
    const resp = project.requirementResponses || {};
    return (
      <div>
        <div className="flex items-center gap-2 font-mono text-[12px] text-[#0F9D6B] uppercase tracking-wide mb-4"><Check size={15} /> Client submitted their requirements</div>
        <div className="border-2 border-[#17222F] divide-y-2 divide-[#17222F]">
          {(project.requirementForm?.fields || []).map((f) => (
            <div key={f.id} className="p-4">
              <div className="font-mono text-[11px] text-[#9AA0AD] uppercase tracking-wide mb-1">{f.label}</div>
              <div className="text-[15px] text-[#17222F]">{formatAnswer(resp[f.id])}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <p className="text-[14px] text-[#5A6473] max-w-md">Build the requirement form the client fills in. {project.requirementStatus === "pending" ? "Sent — awaiting the client." : "Still a draft."}</p>
        <div className="flex gap-2">
          {canWrite && dirty && <button onClick={save} className="bg-[#E5322B] text-white px-4 py-2 font-bold uppercase tracking-wide text-[12px] flex items-center gap-2"><Check size={14} /> Save form</button>}
          {canWrite && !dirty && <button onClick={() => sendRequirementForm(project)} className="bg-[#17222F] text-white px-4 py-2 font-bold uppercase tracking-wide text-[12px] flex items-center gap-2 hover:bg-[#E5322B] transition-colors"><Send size={14} /> {project.requirementStatus === "pending" ? "Re-notify" : "Send to client"}</button>}
        </div>
      </div>
      <div className="border-2 border-[#17222F] divide-y-2 divide-[#17222F]">
        {fields.map((f, i) => (
          <div key={f.id} className="p-4 flex items-start gap-3">
            <div className="flex flex-col gap-1 pt-1">
              <button disabled={!canWrite} onClick={() => move(i, -1)} className="text-[#9AA0AD] hover:text-[#17222F] disabled:opacity-30"><ArrowUp size={14} /></button>
              <button disabled={!canWrite} onClick={() => move(i, 1)} className="text-[#9AA0AD] hover:text-[#17222F] disabled:opacity-30"><ArrowDown size={14} /></button>
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <input disabled={!canWrite} value={f.label} onChange={(e) => edit(f.id, { label: e.target.value })} className="w-full font-semibold text-[14px] text-[#17222F] bg-transparent border-b-2 border-transparent focus:border-[#17222F] outline-none" />
              <div className="flex flex-wrap items-center gap-2">
                <select disabled={!canWrite} value={f.type} onChange={(e) => edit(f.id, { type: e.target.value as FieldType })} className="px-2 py-1 border-2 border-[#17222F] text-[12px] font-mono uppercase bg-white">
                  {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <label className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-[#5A6473] cursor-pointer">
                  <input type="checkbox" disabled={!canWrite} checked={f.required} onChange={(e) => edit(f.id, { required: e.target.checked })} /> Required
                </label>
                {(f.type === "select" || f.type === "multiselect") && (
                  <input disabled={!canWrite} value={(f.options || []).join(", ")} onChange={(e) => edit(f.id, { options: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} placeholder="Options, comma separated" className="flex-1 min-w-[180px] px-2 py-1 border-2 border-[#17222F] text-[12px] bg-white" />
                )}
              </div>
            </div>
            {canWrite && <button onClick={() => remove(f.id)} className="text-[#9AA0AD] hover:text-[#E5322B]"><Trash2 size={16} /></button>}
          </div>
        ))}
      </div>
      {canWrite && <button onClick={add} className="mt-4 flex items-center gap-2 border-2 border-[#17222F] px-4 py-2.5 font-bold uppercase tracking-wide text-[12.5px] hover:bg-[#17222F] hover:text-white transition-colors"><Plus size={15} /> Add field</button>}
    </div>
  );
}

// ── Members ─────────────────────────────────────────────────────────────────
function MembersTab({ project, canWrite }: { project: Project; canWrite: boolean }) {
  const [members, setMembers] = useState<Member[]>([]);
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "members"), orderBy("createdAt", "asc")), (snap) => {
      setMembers(snap.docs.map((d) => ({ uid: d.id, ...d.data() })) as Member[]);
    });
    return () => unsub();
  }, []);

  const assigned = new Set(project.members || []);
  const toggle = (uid: string) => {
    if (!canWrite) return;
    const next = assigned.has(uid) ? (project.members || []).filter((m) => m !== uid) : [...(project.members || []), uid];
    updateProject(project.id, { members: next });
    logAction("Updated project members", project.title, project.id);
  };

  return (
    <div>
      <p className="text-[14px] text-[#5A6473] mb-4">Assign the team working on this project.</p>
      <div className="border-2 border-[#17222F] divide-y-2 divide-[#17222F]">
        {members.map((m) => {
          const on = assigned.has(m.uid);
          return (
            <button key={m.uid} disabled={!canWrite} onClick={() => toggle(m.uid)} className={`w-full flex items-center gap-3 p-4 text-left transition-colors ${on ? "bg-[#FBE9E7]" : "bg-white hover:bg-[#F2F2F2]"}`}>
              <div className={`w-6 h-6 border-2 border-[#17222F] flex items-center justify-center shrink-0 ${on ? "bg-[#E5322B] border-[#E5322B]" : "bg-white"}`}>{on && <Check size={14} className="text-white" />}</div>
              <div className="w-9 h-9 bg-[#17222F] text-white flex items-center justify-center font-bold shrink-0">{(m.name || m.email || "?").charAt(0).toUpperCase()}</div>
              <div className="min-w-0"><div className="font-semibold text-[14px] text-[#17222F] truncate">{m.name || m.email}</div><div className="font-mono text-[11px] text-[#9AA0AD] truncate">{m.roleName || "No role"}</div></div>
            </button>
          );
        })}
        {members.length === 0 && <div className="p-5 font-mono text-[12px] text-[#9AA0AD] uppercase">No members yet.</div>}
      </div>
    </div>
  );
}

// ── Payments ──────────────────────────────────────────────────────────────
function Payments({ project, canWrite }: { project: Project; canWrite: boolean }) {
  const milestones = project.paymentMilestones || [];
  const total = project.totalAmount || 0;
  const [totalInput, setTotalInput] = useState(String(total || ""));
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ label: "", percent: "", stageId: "" });

  const saveTotal = () => { const t = Number(totalInput) || 0; if (t !== total) updateProject(project.id, { totalAmount: t }); };

  const percent = Number(form.percent) || 0;
  const previewAmount = amountFromPercent(total, percent);

  const add = async () => {
    if (!form.label.trim() || !percent) return;
    const m: Milestone = { id: genId(), label: form.label.trim(), percent, amount: amountFromPercent(total, percent), stageId: form.stageId || undefined, status: "due" };
    await saveMilestones(project.id, [...milestones, m]);
    await logAction("Added payment milestone", `${project.title}: ${m.label} (${percent}% = ₹${m.amount})`, project.id);
    setForm({ label: "", percent: "", stageId: "" }); setAdding(false);
  };
  const remove = async (mid: string) => saveMilestones(project.id, milestones.filter((m) => m.id !== mid));
  const markPaid = async (mid: string) => recordPayment(project, mid);

  const allocatedPct = milestones.reduce((s, m) => s + (m.percent || 0), 0);
  const billed = milestones.reduce((s, m) => s + m.amount, 0);
  const paid = milestones.filter((m) => m.status === "paid").reduce((s, m) => s + m.amount, 0);

  return (
    <div>
      {/* Total project value */}
      <div className="border-2 border-[#17222F] bg-white p-5 mb-5 flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[200px]">
          <label className="block font-mono text-[12px] text-[#E5322B] uppercase tracking-[0.1em] font-bold mb-2">Total project value (₹)</label>
          <input type="number" disabled={!canWrite} value={totalInput} onChange={(e) => setTotalInput(e.target.value)} onBlur={saveTotal} placeholder="e.g. 500000" className={inputCls} />
          <p className="font-mono text-[11px] text-[#9AA0AD] mt-1.5">Milestones are entered as a % of this total — amounts are calculated for you.</p>
        </div>
        <div className="font-mono text-[12px] text-[#5A6473]">Allocated: <span className={`font-bold ${allocatedPct > 100 ? "text-[#E5322B]" : "text-[#17222F]"}`}>{allocatedPct}%</span></div>
      </div>

      <div className="grid grid-cols-3 gap-0 border-2 border-[#17222F] mb-5 divide-x-2 divide-[#17222F] w-full sm:w-fit">
        <Stat label="Billed" value={`₹${billed.toLocaleString("en-IN")}`} />
        <Stat label="Collected" value={`₹${paid.toLocaleString("en-IN")}`} accent />
        <Stat label="Total" value={`₹${total.toLocaleString("en-IN")}`} />
      </div>

      <div className="border-2 border-[#17222F] divide-y-2 divide-[#17222F]">
        {milestones.map((m) => {
          const stage = (project.stages || []).find((s) => s.id === m.stageId);
          return (
            <div key={m.id} className="p-4 flex items-center gap-3 sm:gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[15px] text-[#17222F] uppercase tracking-tight">{m.label}{m.percent != null && <span className="text-[#E5322B]"> · {m.percent}%</span>}</div>
                <div className="font-mono text-[11px] text-[#9AA0AD] mt-0.5">{stage ? `Stage: ${stage.name}` : "No stage link"}{m.razorpayPaymentId ? ` · ${m.razorpayPaymentId}` : ""}</div>
              </div>
              <div className="text-[18px] font-black text-[#17222F]">₹{m.amount.toLocaleString("en-IN")}</div>
              {m.status === "paid" ? (
                <span className="px-3 py-1.5 border-2 border-[#0F9D6B] bg-[#E6F6EF] text-[#0F9D6B] font-bold uppercase text-[11px] tracking-wide">Paid</span>
              ) : (
                <span className="px-3 py-1.5 border-2 border-[#B7791F] bg-[#FFF6E5] text-[#B7791F] font-bold uppercase text-[11px] tracking-wide">Due</span>
              )}
              {canWrite && m.status !== "paid" && <button onClick={() => markPaid(m.id)} className="font-mono text-[11px] uppercase tracking-wide text-[#0F9D6B] hover:underline">Mark paid</button>}
              {canWrite && <button onClick={() => remove(m.id)} className="text-[#9AA0AD] hover:text-[#E5322B]"><Trash2 size={15} /></button>}
            </div>
          );
        })}
        {milestones.length === 0 && <div className="p-5 font-mono text-[12px] text-[#9AA0AD] uppercase">No payment milestones yet.</div>}
      </div>

      {canWrite && (adding ? (
        <div className="mt-4 border-2 border-[#17222F] p-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[150px]"><label className="block font-mono text-[11px] uppercase tracking-wide text-[#17222F] mb-1.5">Label</label><input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. Advance" className={inputCls} /></div>
          <div className="w-28"><label className="block font-mono text-[11px] uppercase tracking-wide text-[#17222F] mb-1.5">Percent %</label><input type="number" value={form.percent} onChange={(e) => setForm({ ...form, percent: e.target.value })} placeholder="50" className={inputCls} /></div>
          <div className="w-36"><label className="block font-mono text-[11px] uppercase tracking-wide text-[#17222F] mb-1.5">Stage (optional)</label>
            <select value={form.stageId} onChange={(e) => setForm({ ...form, stageId: e.target.value })} className={inputCls}><option value="">—</option>{(project.stages || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div className="font-mono text-[13px] text-[#17222F] pb-3">= <span className="font-black">₹{previewAmount.toLocaleString("en-IN")}</span></div>
          <button onClick={add} disabled={!total} className="bg-[#17222F] text-white px-4 py-3 font-bold uppercase tracking-wide text-[12px] hover:bg-[#E5322B] transition-colors disabled:opacity-50">Add</button>
          <button onClick={() => setAdding(false)} className="px-3 py-3 text-[#5A6473] hover:text-[#E5322B]"><X size={16} /></button>
        </div>
      ) : (
        <button onClick={() => total ? setAdding(true) : undefined} disabled={!total} title={total ? "" : "Set a total project value first"} className="mt-4 flex items-center gap-2 border-2 border-[#17222F] px-4 py-2.5 font-bold uppercase tracking-wide text-[12.5px] hover:bg-[#17222F] hover:text-white transition-colors disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-[#17222F]"><Plus size={15} /> Add milestone (by %)</button>
      ))}
    </div>
  );
}

// ── Small shared bits ────────────────────────────────────────────────────────
const inputCls = "w-full px-[14px] py-[11px] rounded-none border-2 border-[#17222F] bg-white text-[#17222F] text-[14px] focus:border-[#E5322B] outline-none disabled:bg-[#F2F2F2]";

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-2 border-[#17222F] bg-white p-5">
      <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#E5322B] font-bold mb-4">{title}</div>
      {children}
    </div>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-3 py-1.5"><span className="font-mono text-[12px] text-[#9AA0AD] uppercase tracking-wide">{label}</span><span className="text-[14px] text-[#17222F] font-medium truncate">{value}</span></div>;
}
function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return <div className="px-5 py-3 text-center"><div className={`text-[18px] font-black leading-none ${accent ? "text-[#E5322B]" : "text-[#17222F]"}`}>{value}</div><div className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#9AA0AD] mt-1.5">{label}</div></div>;
}
function formatAnswer(v: any): string {
  if (v == null || v === "") return "—";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}
