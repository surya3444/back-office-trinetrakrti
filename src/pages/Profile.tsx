import { useEffect, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { UserCircle, Save, Check, ImageOff } from "lucide-react";
import { PageHeader } from "../components/ui";
import { useAuth } from "../lib/auth-context";
import { logAction } from "../lib/audit";

export default function Profile() {
  const { member, user, role, isAdmin } = useAuth();
  const [name, setName] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (member) { setName(member.name || ""); setPhotoURL(member.photoURL || ""); }
  }, [member]);

  const dirty = !!member && (name !== (member.name || "") || photoURL !== (member.photoURL || ""));

  const save = async () => {
    if (!user || !dirty) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "members", user.uid), { name: name.trim(), photoURL: photoURL.trim() });
      await logAction("Updated profile", name.trim());
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const initial = (name || member?.email || "?").charAt(0).toUpperCase();
  const roleLabel = isAdmin ? "Administrator" : (role?.name || member?.roleName || "No role");

  return (
    <div className="font-['Poppins',sans-serif] max-w-3xl">
      <PageHeader icon={UserCircle} eyebrow="Account" accent="#2B41E0" title="Your Profile" subtitle="Update how you appear across the workspace." />

      <div className="bg-white border border-[#E9E6DD] rounded-[24px] p-6 md:p-8 shadow-sm animate-fade-up">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 pb-6 border-b border-[#EEEBE3]">
          <div className="relative">
            {photoURL && !imgError ? (
              <img src={photoURL} alt={name} onError={() => setImgError(true)} className="w-24 h-24 rounded-2xl object-cover border border-[#E9E6DD] shadow-sm" />
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-[#13182B] text-white flex items-center justify-center text-[36px] font-bold shadow-sm">{initial}</div>
            )}
            {photoURL && imgError && (
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-[#FFEDE9] text-[#FF5C49] text-[10px] font-mono px-2 py-0.5 rounded-full whitespace-nowrap"><ImageOff size={10} /> bad URL</div>
            )}
          </div>
          <div className="text-center sm:text-left">
            <h2 className="text-[22px] font-bold text-[#13182B] leading-tight">{name || "Your name"}</h2>
            <p className="text-[#6B7283] text-[14.5px] mt-1">{member?.email || user?.email}</p>
            <span className="inline-flex items-center gap-1.5 mt-3 font-mono text-[11px] uppercase tracking-wider font-semibold text-[#2B41E0] bg-[#EDEFFF] px-2.5 py-1 rounded-full">{roleLabel}</span>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-5 pt-6">
          <div className="sm:col-span-2">
            <label className="block font-mono text-[12px] text-[#6B7283] mb-[7px]">Display name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-[14px] py-[13px] rounded-xl border border-[#D7D3C7] bg-[#FCFBF8] text-[#13182B] focus:border-[#2B41E0] outline-none" />
          </div>
          <div className="sm:col-span-2">
            <label className="block font-mono text-[12px] text-[#6B7283] mb-[7px]">Profile image URL</label>
            <input value={photoURL} onChange={(e) => { setPhotoURL(e.target.value); setImgError(false); }} placeholder="https://example.com/avatar.jpg" className="w-full px-[14px] py-[13px] rounded-xl border border-[#D7D3C7] bg-[#FCFBF8] text-[#13182B] focus:border-[#2B41E0] outline-none" />
            <p className="text-[12px] text-[#9AA0AD] mt-1.5">Paste a link to a hosted image (e.g. from your Google profile, Gravatar, or any image host).</p>
          </div>
          <div>
            <label className="block font-mono text-[12px] text-[#9AA0AD] mb-[7px]">Email</label>
            <div className="px-[14px] py-[13px] rounded-xl border border-[#EEEBE3] bg-[#F7F5EF] text-[#6B7283] text-[14px]">{member?.email || user?.email}</div>
          </div>
          <div>
            <label className="block font-mono text-[12px] text-[#9AA0AD] mb-[7px]">Role</label>
            <div className="px-[14px] py-[13px] rounded-xl border border-[#EEEBE3] bg-[#F7F5EF] text-[#6B7283] text-[14px]">{roleLabel}</div>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-7">
          <button onClick={save} disabled={!dirty || saving} className="bg-[#13182B] text-white px-6 py-3 rounded-xl font-semibold text-[14.5px] flex items-center gap-2 shadow-md hover:-translate-y-0.5 transition-transform disabled:opacity-50 disabled:hover:translate-y-0">
            {saving ? "Saving…" : "Save changes"} <Save size={16} />
          </button>
          {saved && <span className="flex items-center gap-1.5 text-[#0F9D6B] text-[14px] font-semibold animate-fade-in"><Check size={16} /> Saved</span>}
        </div>
      </div>
    </div>
  );
}
