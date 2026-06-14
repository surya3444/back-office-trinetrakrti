import { useEffect, useState } from "react";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut } from "firebase/auth";
import { collection, onSnapshot, query, orderBy, doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db, auth, firebaseConfig } from "../lib/firebase";
import { Users, UserPlus, X, Ban, CheckCircle2, Trash2, Mail } from "lucide-react";
import type { Member, Role } from "../lib/permissions";
import { PageHeader, Loader, EmptyState } from "../components/ui";
import { logAction } from "../lib/audit";
import { useAuth } from "../lib/auth-context";

export default function Members() {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [form, setForm] = useState({ name: "", email: "", password: "", roleId: "" });

  useEffect(() => {
    const unsubM = onSnapshot(query(collection(db, "members"), orderBy("createdAt", "asc")), (snap) => {
      setMembers(snap.docs.map((d) => ({ uid: d.id, ...d.data() })) as Member[]);
      setLoading(false);
    });
    const unsubR = onSnapshot(query(collection(db, "roles"), orderBy("createdAt", "asc")), (snap) => {
      setRoles(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Role[]);
    });
    return () => { unsubM(); unsubR(); };
  }, []);

  const createMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setNotice(""); setSaving(true);
    // Create the auth user on a throwaway secondary app so our admin session is untouched.
    const secondary = initializeApp(firebaseConfig, `secondary-${Date.now()}`);
    const secAuth = getAuth(secondary);
    try {
      const cred = await createUserWithEmailAndPassword(secAuth, form.email.trim(), form.password);
      const uid = cred.user.uid;
      await signOut(secAuth);

      const selectedRole = roles.find((r) => r.id === form.roleId);
      await setDoc(doc(db, "members", uid), {
        uid,
        email: form.email.trim(),
        name: form.name.trim() || form.email.trim(),
        roleId: form.roleId || null,
        roleName: selectedRole?.name || "",
        disabled: false,
        createdAt: serverTimestamp(),
        createdBy: user?.uid || "",
      });

      // Let the member set their own password.
      try { await sendPasswordResetEmail(auth, form.email.trim()); } catch { /* non-fatal */ }

      await logAction("Added member", `${form.name.trim() || form.email.trim()} as ${selectedRole?.name || "no role"}`);
      setNotice(`${form.email.trim()} created — a password-set email has been sent.`);
      setForm({ name: "", email: "", password: "", roleId: "" });
      setModal(false);
    } catch (err: any) {
      setError(err?.code === "auth/email-already-in-use" ? "That email already has an account." : err?.message || "Could not create member.");
    } finally {
      try { await deleteApp(secondary); } catch { /* ignore */ }
      setSaving(false);
    }
  };

  const changeRole = async (m: Member, roleId: string) => {
    const r = roles.find((x) => x.id === roleId);
    await updateDoc(doc(db, "members", m.uid), { roleId: roleId || null, roleName: r?.name || "" });
    await logAction("Changed member role", `${m.name} → ${r?.name || "No role"}`);
  };

  const toggleDisabled = async (m: Member) => {
    await updateDoc(doc(db, "members", m.uid), { disabled: !m.disabled });
    await logAction(m.disabled ? "Enabled member" : "Disabled member", m.name);
  };

  const removeMember = async (m: Member) => {
    if (!confirm(`Remove ${m.name}? They will lose access immediately. (Their login account remains in Firebase Auth and can be deleted there.)`)) return;
    await deleteDoc(doc(db, "members", m.uid));
    await logAction("Removed member", m.name);
  };

  if (loading) return <Loader label="Loading members" sub="Fetching your team" />;

  const activeCount = members.filter((m) => !m.disabled).length;

  return (
    <div className="font-['Poppins',sans-serif]">
      <PageHeader
        icon={Users}
        eyebrow="Administration"
        accent="#2B41E0"
        title="Members"
        subtitle="Invite teammates and assign them a role. New members receive an email to set their own password."
        stats={[
          { label: "Active", value: activeCount, accent: "#0F9D6B" },
          { label: "Total", value: members.length, accent: "#13182B" },
        ]}
        actions={
          <button onClick={() => { setError(""); setForm({ name: "", email: "", password: "", roleId: roles[0]?.id || "" }); setModal(true); }} className="bg-[#13182B] text-white px-5 py-2.5 rounded-xl font-semibold text-[14.5px] flex items-center gap-2 hover:-translate-y-0.5 transition-transform shadow-md">
            <UserPlus size={18} /> Add Member
          </button>
        }
      />

      {notice && <div className="mb-5 flex items-center gap-2.5 bg-[#E6F6EF] border border-[#0F9D6B]/30 rounded-xl px-4 py-3 text-[14px] text-[#0b6e4b] animate-fade-up"><CheckCircle2 size={16} /> {notice}</div>}

      <div className="bg-white border border-[#D7D3C7] rounded-[20px] overflow-x-auto shadow-sm animate-fade-up">
        <table className="w-full text-left border-collapse min-w-[720px]">
          <thead className="bg-[#F4F2EC] text-[12.5px] text-[#6B7283] border-b border-[#E5E2D9]">
            <tr>
              <th className="p-4 font-semibold">Member</th>
              <th className="p-4 font-semibold">Role</th>
              <th className="p-4 font-semibold">Status</th>
              <th className="p-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E2D9]">
            {members.map((m) => {
              const self = m.uid === user?.uid;
              return (
                <tr key={m.uid} className="hover:bg-[#FCFBF8] transition-colors">
                  <td className="p-4">
                    <div className="font-semibold text-[#13182B] text-[14.5px] flex items-center gap-2">{m.name}{self && <span className="font-mono text-[9px] uppercase tracking-wider text-[#0F9D6B] bg-[#E6F6EF] px-1.5 py-0.5 rounded">you</span>}</div>
                    <div className="text-[13px] text-[#6B7283]">{m.email}</div>
                  </td>
                  <td className="p-4">
                    <select value={m.roleId || ""} disabled={self} onChange={(e) => changeRole(m, e.target.value)} className="bg-[#FCFBF8] border border-[#D7D3C7] rounded-lg px-3 py-2 text-[13px] font-medium text-[#13182B] outline-none focus:border-[#2B41E0] disabled:opacity-60 cursor-pointer">
                      <option value="">No role</option>
                      {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </td>
                  <td className="p-4">
                    <span className={`font-mono text-[11px] px-2.5 py-1 rounded-full font-semibold ${m.disabled ? "bg-[#FFEDE9] text-[#FF5C49]" : "bg-[#E6F6EF] text-[#0F9D6B]"}`}>{m.disabled ? "Disabled" : "Active"}</span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-1.5">
                      {!self && (
                        <>
                          <button title={m.disabled ? "Enable" : "Disable"} onClick={() => toggleDisabled(m)} className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${m.disabled ? "text-[#0F9D6B] bg-[#E6F6EF] hover:bg-[#0F9D6B] hover:text-white" : "text-[#B7791F] bg-[#FFF6E5] hover:bg-[#F59E0B] hover:text-white"}`}>{m.disabled ? <CheckCircle2 size={16} /> : <Ban size={16} />}</button>
                          <button title="Remove" onClick={() => removeMember(m)} className="w-9 h-9 flex items-center justify-center rounded-lg text-[#9AA0AD] bg-[#F4F2EC] hover:bg-[#FF5C49] hover:text-white transition-colors"><Trash2 size={16} /></button>
                        </>
                      )}
                      {self && <span className="text-[12px] text-[#C4C0B4] font-mono pr-2">—</span>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {members.length === 0 && <div className="p-6"><EmptyState icon={Users} title="No members yet" sub="Add your first teammate to get started." /></div>}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#13182B] bg-opacity-40 backdrop-blur-sm overflow-y-auto animate-fade-in">
          <form onSubmit={createMember} className="bg-white w-full max-w-md border border-[#D7D3C7] rounded-[24px] shadow-2xl overflow-hidden my-8 animate-scale-in">
            <div className="px-6 py-5 border-b border-[#E5E2D9] flex justify-between items-center bg-[#FCFBF8]">
              <h2 className="text-[20px] font-bold text-[#13182B]">Add member</h2>
              <button type="button" onClick={() => setModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#E5E2D9] text-[#6B7283] hover:bg-[#D7D3C7]"><X size={16} strokeWidth={2.5} /></button>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="bg-[#FFEDE9] text-[#b23a2c] text-[13.5px] rounded-lg px-3.5 py-2.5">{error}</div>}
              <div>
                <label className="block font-mono text-[12px] text-[#6B7283] mb-[7px]">Full name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-[14px] py-[13px] rounded-xl border border-[#D7D3C7] bg-[#FCFBF8] text-[#13182B] focus:border-[#2B41E0] outline-none" />
              </div>
              <div>
                <label className="block font-mono text-[12px] text-[#6B7283] mb-[7px]">Email <span className="text-[#FF5C49]">*</span></label>
                <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-[14px] py-[13px] rounded-xl border border-[#D7D3C7] bg-[#FCFBF8] text-[#13182B] focus:border-[#2B41E0] outline-none" />
              </div>
              <div>
                <label className="block font-mono text-[12px] text-[#6B7283] mb-[7px]">Temporary password <span className="text-[#FF5C49]">*</span></label>
                <input type="text" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 6 characters" className="w-full px-[14px] py-[13px] rounded-xl border border-[#D7D3C7] bg-[#FCFBF8] text-[#13182B] focus:border-[#2B41E0] outline-none" />
                <p className="text-[12px] text-[#9AA0AD] mt-1.5 flex items-center gap-1.5"><Mail size={12} /> They'll get an email to set their own password.</p>
              </div>
              <div>
                <label className="block font-mono text-[12px] text-[#6B7283] mb-[7px]">Role</label>
                <select value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })} className="w-full px-[14px] py-[13px] rounded-xl border border-[#D7D3C7] bg-[#FCFBF8] text-[#13182B] focus:border-[#2B41E0] outline-none appearance-none">
                  <option value="">No role (no access)</option>
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#E5E2D9] bg-[#FCFBF8] flex gap-3 justify-end">
              <button type="button" onClick={() => setModal(false)} className="px-5 py-2.5 rounded-xl font-semibold text-[14px] text-[#6B7283] bg-[#F4F2EC] hover:bg-[#E5E2D9] transition-colors">Cancel</button>
              <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-xl font-semibold text-[14px] text-white bg-[#13182B] hover:-translate-y-0.5 transition-transform shadow-md disabled:opacity-60 flex items-center gap-2"><UserPlus size={16} /> {saving ? "Creating…" : "Create member"}</button>
            </div>
          </form>
        </div>
      )}

      {roles.length === 0 && (
        <p className="mt-5 text-[13.5px] text-[#9AA0AD]">Tip: create a role on the <strong className="text-[#6B7283]">Roles</strong> screen first, then assign it here.</p>
      )}
    </div>
  );
}
