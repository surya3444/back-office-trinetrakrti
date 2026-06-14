import { useState } from "react";
import { X, Check } from "lucide-react";

// Lightweight, reusable note prompt — e.g. capturing the outcome when a
// follow-up is completed.
export function NotePromptModal({
  title,
  subtitle,
  label,
  placeholder,
  confirmLabel = "Save",
  accent = "#0F9D6B",
  requireNote = false,
  onCancel,
  onConfirm,
}: {
  title: string;
  subtitle?: string;
  label: string;
  placeholder?: string;
  confirmLabel?: string;
  accent?: string;
  requireNote?: boolean;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  const disabled = requireNote && !note.trim();

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-[#13182B]/40 backdrop-blur-sm animate-fade-in font-['Poppins',sans-serif]">
      <div className="bg-white w-full max-w-md border border-[#D7D3C7] rounded-[24px] shadow-2xl overflow-hidden animate-scale-in">
        <div className="px-6 py-5 border-b border-[#E5E2D9] flex justify-between items-center bg-[#FCFBF8]">
          <div className="min-w-0">
            <h2 className="text-[18px] font-bold text-[#13182B] leading-tight">{title}</h2>
            {subtitle && <p className="text-[13px] text-[#6B7283] mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#E5E2D9] text-[#6B7283] hover:bg-[#D7D3C7] shrink-0"><X size={16} strokeWidth={2.5} /></button>
        </div>

        <div className="p-6">
          <label className="font-mono text-[12px] text-[#6B7283] mb-1.5 block">{label}{requireNote && <span className="text-[#FF5C49]"> *</span>}</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            autoFocus
            placeholder={placeholder}
            className="w-full px-[14px] py-[11px] rounded-xl border border-[#D7D3C7] bg-[#FCFBF8] text-[#13182B] text-[14px] focus:border-[#2B41E0] outline-none resize-none leading-relaxed"
          />
        </div>

        <div className="px-6 py-4 border-t border-[#E5E2D9] bg-[#FCFBF8] flex gap-3 justify-end">
          <button onClick={onCancel} className="px-5 py-2.5 rounded-xl font-semibold text-[14px] text-[#6B7283] bg-[#F4F2EC] hover:bg-[#E5E2D9] transition-colors">Cancel</button>
          <button onClick={() => onConfirm(note.trim())} disabled={disabled} className="px-5 py-2.5 rounded-xl font-semibold text-[14px] text-white shadow-md hover:-translate-y-0.5 transition-transform flex items-center gap-2 disabled:opacity-50 disabled:hover:translate-y-0" style={{ background: "#13182B" }}>
            <Check size={16} style={{ color: accent }} /> {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
