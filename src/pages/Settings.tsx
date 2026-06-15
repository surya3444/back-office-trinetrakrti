import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Plus, Trash2, Save, CalendarClock, SlidersHorizontal } from "lucide-react";
import { PageHeader, Loader } from "../components/ui";
import { logAction } from "../lib/audit";
import { useAuth } from "../lib/auth-context";

export interface PipelineStage {
  id: string;
  name: string;
  color: string;
  // When true, dragging a lead into this stage asks for a follow-up date and
  // surfaces the lead on the Follow-ups calendar.
  isFollowUp?: boolean;
}

const DEFAULT_STAGES: PipelineStage[] = [
  { id: "1", name: "Qualified", color: "#E5322B" },
  { id: "2", name: "Contacted", color: "#E5322B" },
  { id: "3", name: "Follow Up", color: "#F59E0B", isFollowUp: true },
  { id: "4", name: "Proposal", color: "#8B5CF6" },
  { id: "5", name: "Converted", color: "#0F9D6B" }, // Final stage → auto-creates a CRM client
];

export default function Settings() {
  const { can } = useAuth();
  const canWrite = can("settings", "write");
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchSettings() {
      const docRef = doc(db, "settings", "pipeline");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().stages) {
        setStages(docSnap.data().stages);
      } else {
        setStages(DEFAULT_STAGES); // Load defaults if none exist
      }
      setLoading(false);
    }
    fetchSettings();
  }, []);

  const handleAddStage = () => {
    setStages([...stages, { id: Date.now().toString(), name: "New Stage", color: "#5A6473" }]);
  };

  const handleRemoveStage = (id: string) => {
    if (stages.length <= 2) return alert("You must have at least 2 stages.");
    setStages(stages.filter(s => s.id !== id));
  };

  const handleChange = (id: string, field: "name" | "color", value: string) => {
    setStages(stages.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const toggleFollowUp = (id: string) => {
    setStages(stages.map(s => s.id === id ? { ...s, isFollowUp: !s.isFollowUp } : s));
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "settings", "pipeline"), { stages });
      await logAction("Updated pipeline settings", `${stages.length} stages`);
      alert("Pipeline stages saved successfully!");
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader label="Loading settings" sub="Fetching your pipeline configuration" />;

  return (
    <div className="font-['Inter',sans-serif] max-w-3xl">
      <PageHeader
        icon={SlidersHorizontal}
        eyebrow="Lead Management"
        title="Settings"
        subtitle="Design your sales pipeline. Reorder, recolor, and mark which stages should trigger a follow-up reminder. The final stage automatically converts a lead into a CRM client."
        stats={[
          { label: "Stages", value: stages.length, accent: "#E5322B" },
          { label: "Follow-up", value: stages.filter(s => s.isFollowUp).length, accent: "#F59E0B" },
        ]}
      />

      <div className="bg-[#FFFFFF] border border-[#17222F] rounded-none p-6 md:p-8 animate-fade-up">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold text-[#17222F]">Pipeline Stages</h2>
            <p className="text-[#9AA0AD] text-[13.5px] mt-1">Leads flow left → right. The last stage is the finish line.</p>
          </div>
          {canWrite && (
            <button onClick={handleAddStage} className="flex items-center gap-2 bg-[#F2F2F2] text-[#E5322B] font-semibold text-sm px-4 py-2.5 rounded-none hover:bg-[#E5322B] hover:text-white transition-colors">
              <Plus size={16} /> Add Stage
            </button>
          )}
        </div>

        <div className="space-y-3">
          {stages.map((stage, index) => {
            const isFinal = index === stages.length - 1;
            return (
              <div key={stage.id} className="flex flex-wrap items-center gap-3 bg-[#F2F2F2] p-3 rounded-none border border-[#17222F] transition-colors hover:border-[#17222F]" style={{ borderLeft: `4px solid ${stage.color}` }}>
                <div className="font-mono text-xs text-[#9AA0AD] w-6 text-center shrink-0">{index + 1}</div>

                <input
                  type="text"
                  value={stage.name}
                  onChange={(e) => handleChange(stage.id, "name", e.target.value)}
                  className="flex-1 min-w-[120px] bg-white border border-[#17222F] px-3 py-2 rounded-none text-[14px] font-medium outline-none focus:border-[#E5322B]"
                />

                <div className="flex items-center gap-2 bg-white border border-[#17222F] px-2 py-1.5 rounded-none shrink-0">
                  <input
                    type="color"
                    value={stage.color}
                    onChange={(e) => handleChange(stage.id, "color", e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent"
                  />
                  <span className="font-mono text-xs text-[#5A6473] w-16 uppercase">{stage.color}</span>
                </div>

                {/* Follow-up toggle */}
                <button
                  onClick={() => toggleFollowUp(stage.id)}
                  title="Ask for a follow-up date whenever a lead enters this stage"
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-none text-[12.5px] font-semibold border transition-colors shrink-0 ${
                    stage.isFollowUp
                      ? "bg-[#FFF6E5] text-[#B7791F] border-[#F59E0B]"
                      : "bg-white text-[#9AA0AD] border-[#17222F] hover:text-[#5A6473] hover:border-[#9AA0AD]"
                  }`}
                >
                  <CalendarClock size={15} /> Follow-up
                </button>

                {isFinal ? (
                  <span className="font-mono text-[10px] uppercase tracking-wider font-semibold text-[#0F9D6B] bg-[#E6F6EF] px-2.5 py-1.5 rounded-none shrink-0">Final → CRM</span>
                ) : (
                  <button onClick={() => handleRemoveStage(stage.id)} className="text-[#9AA0AD] hover:text-[#E5322B] p-2 shrink-0">
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-5 mb-6 grid sm:grid-cols-2 gap-3">
          <div className="flex gap-3 bg-[#FFF6E5] border border-[#F59E0B]/30 rounded-none p-3.5">
            <CalendarClock size={18} className="text-[#B7791F] shrink-0 mt-0.5" />
            <p className="text-[12.5px] text-[#8a6420] leading-relaxed"><strong>Follow-up stages</strong> prompt for a date and appear on the Follow-ups calendar.</p>
          </div>
          <div className="flex gap-3 bg-[#E6F6EF] border border-[#0F9D6B]/30 rounded-none p-3.5">
            <Save size={18} className="text-[#0F9D6B] shrink-0 mt-0.5" />
            <p className="text-[12.5px] text-[#0b6e4b] leading-relaxed">The <strong>last stage</strong> is the finish line — dropping a lead there creates a CRM client.</p>
          </div>
        </div>

        {canWrite ? (
          <button
            onClick={saveSettings}
            disabled={saving}
            className="bg-[#17222F] text-white px-6 py-3 rounded-none font-semibold text-[14.5px] flex items-center gap-2 hover:-translate-y-0.5 transition-transform disabled:opacity-70 w-full justify-center md:w-auto"
          >
            {saving ? "Saving…" : "Save Changes"} <Save size={16} />
          </button>
        ) : (
          <p className="font-mono text-[12px] text-[#9AA0AD]">You have read-only access to settings.</p>
        )}
      </div>
    </div>
  );
}