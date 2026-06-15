import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../lib/firebase";
import { FolderKanban, Plus, X, ChevronRight, CircleDollarSign, ClipboardList } from "lucide-react";
import { PageHeader, Loader, EmptyState } from "../components/ui";
import { useAuth } from "../lib/auth-context";
import { createProject, stageProgress, type Project, type ProjectStatus } from "../lib/projects";

interface Client { id: string; name: string; company?: string; email?: string }

const STATUS_STYLE: Record<ProjectStatus, string> = {
  active: "bg-[#E5322B] text-white border-[#E5322B]",
  on_hold: "bg-[#FFF6E5] text-[#B7791F] border-[#B7791F]",
  completed: "bg-[#E6F6EF] text-[#0F9D6B] border-[#0F9D6B]",
};
const STATUS_LABEL: Record<ProjectStatus, string> = { active: "Active", on_hold: "On hold", completed: "Completed" };

export default function Projects() {
  const { can, member } = useAuth();
  const canWrite = can("projects", "write");
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", clientId: "", clientName: "", clientEmail: "", dueDate: "" });

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "projects"), orderBy("createdAt", "desc")), (snap) => {
      setProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Project[]);
      setLoadError("");
      setLoading(false);
    }, (err) => {
      setLoadError(err.code === "permission-denied"
        ? "Couldn't load projects — your Firestore rules may not be deployed. Run: firebase deploy --only firestore:rules"
        : err.message);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "clients"), orderBy("createdAt", "desc")), (snap) => {
      setClients(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Client[]);
    }, () => {});
    return () => unsub();
  }, []);

  const pickClient = (clientId: string) => {
    const c = clients.find((x) => x.id === clientId);
    setForm((f) => ({ ...f, clientId, clientName: c?.name || "", clientEmail: c?.email || "" }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.clientId) return;
    setSaving(true);
    try {
      const id = await createProject({
        title: form.title.trim(),
        clientId: form.clientId || undefined,
        clientName: form.clientName.trim(),
        clientEmail: form.clientEmail.trim() || undefined,
        dueDate: form.dueDate,
        createdBy: member?.uid,
      });
      setShowAdd(false);
      setForm({ title: "", clientId: "", clientName: "", clientEmail: "", dueDate: "" });
      navigate(`/projects/${id}`);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  if (loading) return <Loader label="Loading projects" sub="Gathering your active builds" />;

  // Members without the 'projects' role only see projects they're assigned to.
  const fullRead = can("projects", "read");
  const visible = fullRead ? projects : projects.filter((p) => (p.members || []).includes(member?.uid || ""));
  const active = visible.filter((p) => p.status === "active").length;

  return (
    <div className="font-['Inter',sans-serif]">
      <PageHeader
        icon={FolderKanban}
        eyebrow="Delivery"
        title={fullRead ? "Projects" : "My Projects"}
        subtitle={fullRead ? "Every client build, its stages, requirements and payments — in one place." : "Projects you're assigned to. Mark stages as you complete your work."}
        stats={[
          { label: fullRead ? "Total" : "Assigned", value: visible.length, accent: "#17222F" },
          { label: "Active", value: active, accent: "#E5322B" },
        ]}
        actions={canWrite && (
          <button onClick={() => setShowAdd(true)} className="bg-[#17222F] text-white px-5 py-2.5 rounded-none font-semibold text-[14.5px] flex items-center gap-2 hover:-translate-y-0.5 transition-transform">
            <Plus size={18} /> New Project
          </button>
        )}
      />

      {loadError ? (
        <div className="border-2 border-[#E5322B] bg-[#FBE9E7] text-[#E5322B] px-5 py-4 font-medium text-[14px]">{loadError}</div>
      ) : visible.length === 0 ? (
        <EmptyState icon={FolderKanban} title={fullRead ? "No projects yet" : "No assigned projects"} sub={fullRead ? "Create your first project to start tracking stages, requirements and payments." : "You'll see a project here once a manager assigns you to one."} />
      ) : (
        <div className="border-2 border-[#17222F] bg-white overflow-hidden">
          <div className="grid grid-cols-[1.6fr_1fr_0.8fr_1.2fr_auto] gap-4 px-5 py-3 border-b-2 border-[#17222F] font-mono text-[11px] uppercase tracking-[0.1em] text-[#5A6473] bg-[#F2F2F2]">
            <div>Project</div><div>Status</div><div>Stage</div><div>Requirements / Pay</div><div></div>
          </div>
          <div className="divide-y-2 divide-[#17222F]">
            {visible.map((p) => {
              const prog = stageProgress(p.stages || []);
              const cur = (p.stages || []).find((s) => s.id === p.currentStageId);
              const paid = (p.paymentMilestones || []).filter((m) => m.status === "paid").length;
              const due = (p.paymentMilestones || []).length - paid;
              return (
                <button key={p.id} onClick={() => navigate(`/projects/${p.id}`)} className="w-full text-left grid grid-cols-[1.6fr_1fr_0.8fr_1.2fr_auto] gap-4 px-5 py-4 items-center hover:bg-[#F2F2F2] transition-colors group">
                  <div className="min-w-0">
                    <div className="font-bold text-[#17222F] text-[15px] truncate uppercase tracking-tight">{p.title}</div>
                    <div className="text-[13px] text-[#5A6473] truncate">{p.clientName}</div>
                  </div>
                  <div>
                    <span className={`inline-block px-2.5 py-1 rounded-none text-[11px] font-bold uppercase tracking-wide border-2 ${STATUS_STYLE[p.status] || ""}`}>{STATUS_LABEL[p.status] || p.status}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="font-mono text-[11px] text-[#17222F] truncate">{cur?.name || "—"}</div>
                    <div className="h-1.5 bg-[#F2F2F2] border border-[#17222F] mt-1.5"><div className="h-full bg-[#E5322B]" style={{ width: `${prog.pct}%` }} /></div>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-[11px] text-[#5A6473]">
                    <span className="inline-flex items-center gap-1.5"><ClipboardList size={13} className="text-[#17222F]" /> {reqLabel(p.requirementStatus)}</span>
                    <span className="inline-flex items-center gap-1.5"><CircleDollarSign size={13} className="text-[#17222F]" /> {paid}/{paid + due}</span>
                  </div>
                  <ChevronRight size={18} className="text-[#9AA0AD] group-hover:text-[#E5322B] transition-colors justify-self-end" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#17222F]/40 backdrop-blur-sm" onClick={() => setShowAdd(false)}>
          <div className="bg-white w-full max-w-md border-2 border-[#17222F] flex flex-col animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="px-7 py-5 border-b-2 border-[#17222F] flex justify-between items-center">
              <div>
                <div className="font-mono text-[11px] text-[#E5322B] tracking-[0.16em] uppercase font-semibold mb-1">Delivery</div>
                <h2 className="text-[22px] font-black text-[#17222F] leading-none uppercase">New Project</h2>
              </div>
              <button onClick={() => setShowAdd(false)} className="w-8 h-8 flex items-center justify-center bg-[#F2F2F2] text-[#5A6473] hover:bg-[#17222F] hover:text-white transition-colors"><X size={16} strokeWidth={2.5} /></button>
            </div>
            <form onSubmit={submit} className="p-7 flex flex-col gap-5">
              <Field label="Project title">
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. NGO Management App" required className={inputCls} />
              </Field>
              <Field label="Client">
                {clients.length > 0 ? (
                  <>
                    <select value={form.clientId} onChange={(e) => pickClient(e.target.value)} required className={inputCls}>
                      <option value="">— Select a client —</option>
                      {clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.company ? ` · ${c.company}` : ""}</option>)}
                    </select>
                    {form.clientEmail && <p className="font-mono text-[11px] text-[#9AA0AD] mt-1.5">{form.clientEmail}</p>}
                  </>
                ) : (
                  <div className="border-2 border-dashed border-[#17222F] p-4 text-[13px] text-[#5A6473]">
                    No clients yet. Add one in <button type="button" onClick={() => navigate("/crm")} className="text-[#E5322B] font-semibold underline">CRM</button> first.
                  </div>
                )}
              </Field>
              <Field label="Due date (optional)">
                <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className={inputCls} />
              </Field>
              <div className="mt-2 flex gap-3">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 bg-[#F2F2F2] text-[#17222F] font-bold uppercase tracking-wide text-[13px] py-[14px] hover:bg-[#17222F] hover:text-white transition-colors">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 bg-[#17222F] text-white font-bold uppercase tracking-wide text-[13px] py-[14px] hover:bg-[#E5322B] transition-colors disabled:opacity-60">{saving ? "Creating…" : "Create"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls = "w-full px-[14px] py-[12px] rounded-none border-2 border-[#17222F] bg-white text-[#17222F] text-[15px] focus:outline-none focus:border-[#E5322B]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block font-mono text-[12px] text-[#17222F] uppercase tracking-[0.08em] mb-[7px]">{label}</label>
      {children}
    </div>
  );
}

function reqLabel(s: Project["requirementStatus"]) {
  return s === "submitted" ? "Submitted" : s === "pending" ? "Awaiting" : "Draft";
}
