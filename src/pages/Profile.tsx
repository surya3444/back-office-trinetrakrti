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
    <div className="font-['Inter',sans-serif] max-w-3xl">
      <PageHeader icon={UserCircle} eyebrow="Account" accent="#E5322B" title="Your Profile" subtitle="Update how you appear across the workspace." />

      <div className="bg-white border border-[#17222F] rounded-none p-6 md:p-8 animate-fade-up">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 pb-6 border-b border-[#E6E6E6]">
          <div className="relative">
            {photoURL && !imgError ? (
              <img src={photoURL} alt={name} onError={() => setImgError(true)} className="w-24 h-24 rounded-none object-cover border border-[#17222F]" />
            ) : (
              <div className="w-24 h-24 rounded-none bg-[#17222F] text-white flex items-center justify-center text-[36px] font-bold">{initial}</div>
            )}
            {photoURL && imgError && (
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-[#FBE9E7] text-[#E5322B] text-[10px] font-mono px-2 py-0.5 rounded-none whitespace-nowrap"><ImageOff size={10} /> bad URL</div>
            )}
          </div>
          <div className="text-center sm:text-left">
            <h2 className="text-[22px] font-bold text-[#17222F] leading-tight">{name || "Your name"}</h2>
            <p className="text-[#5A6473] text-[14.5px] mt-1">{member?.email || user?.email}</p>
            <span className="inline-flex items-center gap-1.5 mt-3 font-mono text-[11px] uppercase tracking-wider font-semibold text-[#E5322B] bg-[#F2F2F2] px-2.5 py-1 rounded-none-none">{roleLabel}</span>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-5 pt-6">
          <div className="sm:col-span-2">
            <label className="block font-mono text-[12px] text-[#5A6473] mb-[7px]">Display name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-[14px] py-[13px] rounded-none border border-[#17222F] bg-[#FFFFFF] text-[#17222F] focus:border-[#E5322B] outline-none" />
          </div>
          <div className="sm:col-span-2">
            <label className="block font-mono text-[12px] text-[#5A6473] mb-[7px]">Profile image URL</label>
            <input value={photoURL} onChange={(e) => { setPhotoURL(e.target.value); setImgError(false); }} placeholder="https://example.com/avatar.jpg" className="w-full px-[14px] py-[13px] rounded-none border border-[#17222F] bg-[#FFFFFF] text-[#17222F] focus:border-[#E5322B] outline-none" />
            <p className="text-[12px] text-[#9AA0AD] mt-1.5">Paste a link to a hosted image (e.g. from your Google profile, Gravatar, or any image host).</p>
          </div>
          <div>
            <label className="block font-mono text-[12px] text-[#9AA0AD] mb-[7px]">Email</label>
            <div className="px-[14px] py-[13px] rounded-none border border-[#E6E6E6] bg-[#F2F2F2] text-[#5A6473] text-[14px]">{member?.email || user?.email}</div>
          </div>
          <div>
            <label className="block font-mono text-[12px] text-[#9AA0AD] mb-[7px]">Role</label>
            <div className="px-[14px] py-[13px] rounded-none border border-[#E6E6E6] bg-[#F2F2F2] text-[#5A6473] text-[14px]">{roleLabel}</div>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-7">
          <button onClick={save} disabled={!dirty || saving} className="bg-[#17222F] text-white px-6 py-3 rounded-none font-semibold text-[14.5px] flex items-center gap-2 hover:-translate-y-0.5 transition-transform disabled:opacity-50 disabled:hover:translate-y-0">
            {saving ? "Saving…" : "Save changes"} <Save size={16} />
          </button>
          {saved && <span className="flex items-center gap-1.5 text-[#0F9D6B] text-[14px] font-semibold animate-fade-in"><Check size={16} /> Saved</span>}
        </div>
      </div>
    </div>
  );
}
