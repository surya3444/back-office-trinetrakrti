import { useState } from "react";
import { CalendarClock, X } from "lucide-react";
import { todayStr, addDaysStr } from "../lib/dates";

// Shared modal for scheduling / rescheduling a follow-up. Captures both a date
// and free-text remarks, and is reused by the pipeline, follow-ups, and dashboard.
export function FollowUpModal({
  leadName,
  stageName,
  initialDate,
  initialNote = "",
  confirmLabel = "Schedule",
  onCancel,
  onConfirm,
}: {
  leadName: string;
  stageName?: string;
  initialDate: string;
  initialNote?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: (date: string, note: string) => void;
}) {
  const [date, setDate] = useState(initialDate);
  const [note, setNote] = useState(initialNote);

  const presets = [
    { label: "Tomorrow", days: 1 },
    { label: "In 3 days", days: 3 },
    { label: "Next week", days: 7 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#17222F] bg-opacity-40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-md border border-[#17222F] rounded-none overflow-hidden animate-scale-in">
        <div className="px-6 py-5 border-b border-[#17222F] flex justify-between items-center bg-[#FFF6E5]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-none bg-[#F59E0B]/15 text-[#B7791F] flex items-center justify-center"><CalendarClock size={20} /></div>
            <div>
              <div className="font-mono text-[11px] text-[#B7791F] uppercase font-semibold">Follow-up</div>
              <h2 className="text-[18px] font-bold text-[#17222F] leading-tight">{leadName}</h2>
            </div>
          </div>
          <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center rounded-none bg-white text-[#5A6473] hover:bg-[#F2F2F2] border border-[#17222F]">
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {stageName && (
            <p className="text-[#5A6473] text-[14px] leading-relaxed">
              Stage: <strong className="text-[#17222F]">{stageName}</strong>. Pick when this lead should resurface on your calendar.
            </p>
          )}

          <div className="flex gap-2 flex-wrap">
            {presets.map((opt) => {
              const d = addDaysStr(todayStr(), opt.days);
              const active = date === d;
              return (
                <button key={opt.label} onClick={() => setDate(d)} className={`px-3.5 py-2 rounded-none text-[13px] font-semibold border transition-colors ${
                  active ? "bg-[#17222F] text-white border-[#17222F]" : "bg-white text-[#5A6473] border-[#17222F] hover:border-[#9AA0AD]"
                }`}>{opt.label}</button>
              );
            })}
          </div>

          <div>
            <label className="block font-mono text-[12px] text-[#5A6473] mb-1.5">Follow-up date</label>
            <input
              type="date"
              value={date}
              min={todayStr()}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-[14px] py-[13px] rounded-none border border-[#17222F] bg-[#FFFFFF] text-[#17222F] focus:border-[#F59E0B] outline-none"
            />
          </div>

          <div>
            <label className="block font-mono text-[12px] text-[#5A6473] mb-1.5">Remarks <span className="text-[#9AA0AD] normal-case">(optional)</span></label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="e.g. Left a voicemail — call back after their board meeting."
              className="w-full px-[14px] py-[11px] rounded-none border border-[#17222F] bg-[#FFFFFF] text-[#17222F] text-[14px] focus:border-[#F59E0B] outline-none resize-none leading-relaxed"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[#17222F] bg-[#FFFFFF] flex gap-3 justify-end">
          <button onClick={onCancel} className="px-5 py-2.5 rounded-none font-semibold text-[14px] text-[#5A6473] bg-[#F2F2F2] hover:bg-[#17222F] transition-colors">Cancel</button>
          <button onClick={() => onConfirm(date, note.trim())} className="px-5 py-2.5 rounded-none font-semibold text-[14px] text-white bg-[#17222F] hover:-translate-y-0.5 transition-transform flex items-center gap-2">
            <CalendarClock size={16} /> {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
