import { useState } from "react";
import { ArrowRight, X, StickyNote } from "lucide-react";

// Prompt for an optional remark when moving a lead to a new (non follow-up)
// stage. The note is recorded on the lead's activity so any teammate can pick
// up the follow-up with full context.
export function StageNoteModal({ leadName, stageName, color = "#E5322B", onCancel, onConfirm }: {
  leadName: string;
  stageName: string;
  color?: string;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState("");

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-[#17222F]/40 backdrop-blur-sm animate-fade-in font-['Inter',sans-serif]">
      <div className="bg-white w-full max-w-md border border-[#17222F] rounded-none overflow-hidden animate-scale-in">
        <div className="px-6 py-5 border-b border-[#17222F] flex justify-between items-center bg-[#FFFFFF]">
          <div className="min-w-0">
            <div className="font-mono text-[11px] uppercase font-semibold mb-1" style={{ color }}>Move lead</div>
            <h2 className="text-[18px] font-bold text-[#17222F] leading-tight truncate">{leadName} <span className="text-[#9AA0AD] font-normal">→</span> {stageName}</h2>
          </div>
          <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center rounded-none bg-[#17222F] text-[#5A6473] hover:bg-[#17222F] shrink-0"><X size={16} strokeWidth={2.5} /></button>
        </div>

        <div className="p-6">
          <label className="font-mono text-[12px] text-[#5A6473] mb-1.5 flex items-center gap-1.5"><StickyNote size={13} /> Stage note <span className="text-[#9AA0AD] normal-case">(optional)</span></label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            autoFocus
            placeholder={`What happened? e.g. "Sent proposal, awaiting feedback by Friday."`}
            className="w-full px-[14px] py-[11px] rounded-none border border-[#17222F] bg-[#FFFFFF] text-[#17222F] text-[14px] focus:border-[#E5322B] outline-none resize-none leading-relaxed"
          />
          <p className="text-[12px] text-[#9AA0AD] mt-2">Saved to this lead's activity so anyone can pick up the follow-up.</p>
        </div>

        <div className="px-6 py-4 border-t border-[#17222F] bg-[#FFFFFF] flex gap-3 justify-end">
          <button onClick={onCancel} className="px-5 py-2.5 rounded-none font-semibold text-[14px] text-[#5A6473] bg-[#F2F2F2] hover:bg-[#17222F] transition-colors">Cancel</button>
          <button onClick={() => onConfirm(note.trim())} className="px-5 py-2.5 rounded-none font-semibold text-[14px] text-white bg-[#17222F] hover:-translate-y-0.5 transition-transform flex items-center gap-2">Move <ArrowRight size={16} /></button>
        </div>
      </div>
    </div>
  );
}
