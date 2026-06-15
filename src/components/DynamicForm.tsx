import type { Field } from "../lib/projects";

// Renders a customizable requirement form from a Field[] schema. Controlled:
// the parent owns `values` and gets updates via `onChange`. Shared by the
// client portal (fill mode) and the admin builder (preview / disabled mode).

const inputBase =
  "w-full px-[14px] py-[11px] rounded-none border-2 border-[#17222F] bg-white text-[#17222F] text-[14px] focus:border-[#E5322B] outline-none disabled:bg-[#F2F2F2] disabled:text-[#9AA0AD]";

export function validateForm(fields: Field[], values: Record<string, any>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of fields) {
    if (!f.required) continue;
    const v = values[f.id];
    const empty =
      v == null ||
      v === "" ||
      (Array.isArray(v) && v.length === 0) ||
      (f.type === "checkbox" && !v);
    if (empty) errors[f.id] = "This field is required.";
  }
  return errors;
}

export function DynamicForm({
  fields,
  values,
  onChange,
  disabled = false,
  errors = {},
}: {
  fields: Field[];
  values: Record<string, any>;
  onChange?: (id: string, value: any) => void;
  disabled?: boolean;
  errors?: Record<string, string>;
}) {
  const set = (id: string, value: any) => onChange?.(id, value);

  if (fields.length === 0) {
    return <p className="font-mono text-[12px] text-[#9AA0AD] uppercase tracking-wider">No fields yet.</p>;
  }

  return (
    <div className="space-y-5">
      {fields.map((f) => {
        const v = values[f.id];
        const err = errors[f.id];
        return (
          <div key={f.id}>
            {f.type !== "checkbox" && (
              <label className="block font-mono text-[12px] text-[#17222F] uppercase tracking-[0.08em] mb-[7px]">
                {f.label} {f.required && <span className="text-[#E5322B]">*</span>}
              </label>
            )}

            {f.type === "textarea" ? (
              <textarea rows={4} disabled={disabled} value={v || ""} placeholder={f.placeholder}
                onChange={(e) => set(f.id, e.target.value)} className={`${inputBase} resize-none leading-relaxed`} />
            ) : f.type === "select" ? (
              <select disabled={disabled} value={v || ""} onChange={(e) => set(f.id, e.target.value)} className={inputBase}>
                <option value="">— Select —</option>
                {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : f.type === "multiselect" ? (
              <div className="flex flex-wrap gap-2">
                {(f.options || []).map((o) => {
                  const arr: string[] = Array.isArray(v) ? v : [];
                  const on = arr.includes(o);
                  return (
                    <button type="button" key={o} disabled={disabled}
                      onClick={() => set(f.id, on ? arr.filter((x) => x !== o) : [...arr, o])}
                      className={`px-3 py-1.5 rounded-none border-2 text-[13px] font-semibold uppercase tracking-wide transition-colors ${on ? "bg-[#E5322B] text-white border-[#E5322B]" : "bg-white text-[#17222F] border-[#17222F]"} disabled:opacity-50`}>
                      {o}
                    </button>
                  );
                })}
              </div>
            ) : f.type === "checkbox" ? (
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <button type="button" disabled={disabled} onClick={() => set(f.id, !v)}
                  className={`w-6 h-6 rounded-none border-2 border-[#17222F] flex items-center justify-center shrink-0 ${v ? "bg-[#E5322B] border-[#E5322B]" : "bg-white"}`}>
                  {v && <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="3" strokeLinecap="square" /></svg>}
                </button>
                <span className="text-[14px] text-[#17222F]">{f.label} {f.required && <span className="text-[#E5322B]">*</span>}</span>
              </label>
            ) : (
              <input type={f.type === "number" ? "number" : f.type === "email" ? "email" : f.type === "date" ? "date" : "text"}
                disabled={disabled} value={v || ""} placeholder={f.placeholder}
                onChange={(e) => set(f.id, e.target.value)} className={inputBase} />
            )}

            {err && <p className="font-mono text-[11px] text-[#E5322B] mt-1.5">{err}</p>}
          </div>
        );
      })}
    </div>
  );
}
