import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { ShieldCheck, Plus, Trash2, X, Lock, Pencil } from "lucide-react";
import { MODULES, type Role, type RolePermissions } from "../lib/permissions";
import { PageHeader, Loader, EmptyState } from "../components/ui";
import { logAction } from "../lib/audit";

const emptyPerms = (): RolePermissions => Object.fromEntries(MODULES.map((m) => [m.key, { read: false, write: false }]));

export default function Roles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Role | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [perms, setPerms] = useState<RolePermissions>(emptyPerms());

  useEffect(() => {
    const q = query(collection(db, "roles"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setRoles(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Role[]);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const openNew = () => {
    setEditing(null); setName(""); setIsAdmin(false); setPerms(emptyPerms());
    setModal(true);
  };
  const openEdit = (r: Role) => {
    setEditing(r); setName(r.name); setIsAdmin(!!r.isAdmin);
    setPerms({ ...emptyPerms(), ...r.permissions });
    setModal(true);
  };

  const [modal, setModal] = useState(false);

  const toggle = (key: string, action: "read" | "write") => {
    setPerms((p) => {
      const cur = { ...(p[key] || {}) };
      cur[action] = !cur[action];
      // Granting write implies read; removing read removes write.
      if (action === "write" && cur.write) cur.read = true;
      if (action === "read" && !cur.read) cur.write = false;
      return { ...p, [key]: cur };
    });
  };

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = { name: name.trim(), isAdmin, permissions: isAdmin ? {} : perms };
      if (editing) {
        await updateDoc(doc(db, "roles", editing.id), payload);
        await logAction("Updated role", name.trim());
      } else {
        await addDoc(collection(db, "roles"), { ...payload, createdAt: serverTimestamp() });
        await logAction("Created role", name.trim());
      }
      setModal(false);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const remove = async (r: Role) => {
    if (!confirm(`Delete the “${r.name}” role? Members assigned to it will lose their access.`)) return;
    await deleteDoc(doc(db, "roles", r.id));
    await logAction("Deleted role", r.name);
  };

  if (loading) return <Loader label="Loading roles" sub="Fetching access definitions" />;

  return (
    <div className="font-['Poppins',sans-serif]">
      <PageHeader
        icon={ShieldCheck}
        eyebrow="Administration"
        accent="#8B5CF6"
        title="Roles & Access"
        subtitle="Define what each type of member can see and change. Assign these roles to people on the Members screen."
        stats={[{ label: "Roles", value: roles.length, accent: "#8B5CF6" }]}
        actions={
          <button onClick={openNew} className="bg-[#13182B] text-white px-5 py-2.5 rounded-xl font-semibold text-[14.5px] flex items-center gap-2 hover:-translate-y-0.5 transition-transform shadow-md">
            <Plus size={18} /> New Role
          </button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 animate-fade-up">
        {roles.map((r) => {
          const grants = MODULES.filter((m) => r.isAdmin || r.permissions?.[m.key]?.read);
          return (
            <div key={r.id} className="bg-white border border-[#D7D3C7] rounded-[20px] p-5 shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${r.isAdmin ? "bg-[#8B5CF6]/15 text-[#8B5CF6]" : "bg-[#F4F2EC] text-[#6B7283]"}`}><ShieldCheck size={18} /></div>
                  <div>
                    <h3 className="font-bold text-[#13182B] text-[16px] leading-tight">{r.name}</h3>
                    {r.isAdmin && <span className="font-mono text-[10px] uppercase tracking-wider text-[#8B5CF6] font-semibold">Full access</span>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(r)} className="p-2 rounded-lg text-[#9AA0AD] hover:text-[#13182B] hover:bg-[#F4F2EC] transition-colors"><Pencil size={16} /></button>
                  {!r.isAdmin && <button onClick={() => remove(r)} className="p-2 rounded-lg text-[#9AA0AD] hover:text-[#FF5C49] hover:bg-[#FFEDE9] transition-colors"><Trash2 size={16} /></button>}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {r.isAdmin ? (
                  <span className="font-mono text-[11px] text-[#6B7283]">Everything, including roles, members & activity log</span>
                ) : grants.length === 0 ? (
                  <span className="font-mono text-[11px] text-[#C4C0B4]">No access granted</span>
                ) : grants.map((m) => {
                  const w = r.permissions?.[m.key]?.write;
                  return <span key={m.key} className={`text-[11.5px] font-medium px-2 py-1 rounded-md ${w ? "bg-[#EDEFFF] text-[#2B41E0]" : "bg-[#F4F2EC] text-[#6B7283]"}`}>{m.label}{w ? " ·rw" : " ·r"}</span>;
                })}
              </div>
            </div>
          );
        })}

        {roles.length === 0 && <div className="md:col-span-2"><EmptyState icon={ShieldCheck} title="No roles yet" sub="Create a role to define what members can access." /></div>}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#13182B] bg-opacity-40 backdrop-blur-sm overflow-y-auto animate-fade-in">
          <div className="bg-white w-full max-w-lg border border-[#D7D3C7] rounded-[24px] shadow-2xl overflow-hidden my-8 animate-scale-in">
            <div className="px-6 py-5 border-b border-[#E5E2D9] flex justify-between items-center bg-[#FCFBF8]">
              <h2 className="text-[20px] font-bold text-[#13182B]">{editing ? "Edit role" : "New role"}</h2>
              <button onClick={() => setModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#E5E2D9] text-[#6B7283] hover:bg-[#D7D3C7]"><X size={16} strokeWidth={2.5} /></button>
            </div>
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block font-mono text-[12px] text-[#6B7283] mb-[7px]">Role name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sales Rep" className="w-full px-[14px] py-[13px] rounded-xl border border-[#D7D3C7] bg-[#FCFBF8] text-[#13182B] focus:border-[#8B5CF6] outline-none" />
              </div>

              <label className="flex items-center gap-3 bg-[#F4F2EC] border border-[#E5E2D9] rounded-xl px-4 py-3 cursor-pointer">
                <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} className="w-4 h-4 accent-[#8B5CF6]" />
                <div>
                  <div className="font-semibold text-[14px] text-[#13182B] flex items-center gap-1.5"><Lock size={13} /> Administrator</div>
                  <div className="text-[12.5px] text-[#6B7283]">Full access to everything, including roles, members and the activity log.</div>
                </div>
              </label>

              {!isAdmin && (
                <div className="border border-[#E5E2D9] rounded-xl overflow-hidden">
                  <div className="grid grid-cols-[1fr_auto_auto] bg-[#F4F2EC] text-[#6B7283] font-mono text-[11px] uppercase tracking-wider">
                    <div className="px-4 py-2.5">Module</div>
                    <div className="px-4 py-2.5 w-20 text-center">Read</div>
                    <div className="px-4 py-2.5 w-20 text-center">Write</div>
                  </div>
                  {MODULES.map((m) => (
                    <div key={m.key} className="grid grid-cols-[1fr_auto_auto] items-center border-t border-[#E5E2D9]">
                      <div className="px-4 py-2.5 text-[14px] font-medium text-[#13182B]">{m.label}</div>
                      <div className="px-4 py-2.5 w-20 flex justify-center"><input type="checkbox" checked={!!perms[m.key]?.read} onChange={() => toggle(m.key, "read")} className="w-4 h-4 accent-[#2B41E0]" /></div>
                      <div className="px-4 py-2.5 w-20 flex justify-center"><input type="checkbox" checked={!!perms[m.key]?.write} onChange={() => toggle(m.key, "write")} className="w-4 h-4 accent-[#2B41E0]" /></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-[#E5E2D9] bg-[#FCFBF8] flex gap-3 justify-end">
              <button onClick={() => setModal(false)} className="px-5 py-2.5 rounded-xl font-semibold text-[14px] text-[#6B7283] bg-[#F4F2EC] hover:bg-[#E5E2D9] transition-colors">Cancel</button>
              <button onClick={save} disabled={saving || !name.trim()} className="px-5 py-2.5 rounded-xl font-semibold text-[14px] text-white bg-[#13182B] hover:-translate-y-0.5 transition-transform shadow-md disabled:opacity-60">{saving ? "Saving…" : "Save role"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
