import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy, doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { X, Layers, Trash2, Inbox } from "lucide-react";
import { PageHeader, Loader } from "../components/ui";
import { logAction } from "../lib/audit";
import { useAuth } from "../lib/auth-context";

interface Booking {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  problem: string;
  service: string;
  stage: string;
  status: string;
  createdAt?: any;
}

export default function Leads() {
  const { can } = useAuth();
  const canWrite = can("leads", "write");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Booking | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [firstStage, setFirstStage] = useState("Qualified");

  useEffect(() => {
    const q = query(collection(db, "bookings"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setBookings(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Booking[]);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Read the configured pipeline so approval drops the lead into the first stage.
  useEffect(() => {
    async function fetchFirstStage() {
      const docSnap = await getDoc(doc(db, "settings", "pipeline"));
      const stages = docSnap.exists() ? docSnap.data().stages : null;
      if (stages && stages.length > 0) setFirstStage(stages[0].name);
    }
    fetchFirstStage();
  }, []);

  // Approve a lead: move it onto the Kanban board at the first pipeline stage.
  const handleSendToPipeline = async () => {
    if (!selectedLead) return;
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, "bookings", selectedLead.id), { status: firstStage });
      await logAction("Approved lead to pipeline", `${selectedLead.name} → ${firstStage}`, selectedLead.id);
      setSelectedLead(null);
    } catch (error) {
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleArchiveLead = async () => {
    if (!selectedLead) return;
    await updateDoc(doc(db, "bookings", selectedLead.id), { status: "Archived" });
    await logAction("Archived lead", selectedLead.name, selectedLead.id);
    setSelectedLead(null);
  };

  if (loading) return <Loader label="Loading leads" sub="Checking for new bookings" />;

  const newCount = bookings.filter((b) => b.status === "new" || b.status === "New").length;
  const archivedCount = bookings.filter((b) => b.status === "Archived").length;

  return (
    <div className="font-['Inter',sans-serif] relative">
      <PageHeader
        icon={Inbox}
        eyebrow="Lead Management"
        accent="#E5322B"
        title="Leads"
        subtitle="Every booking from the website lands here first. Review each one, then approve the good fits into your pipeline."
        stats={[
          { label: "New", value: newCount, accent: "#E5322B" },
          { label: "Total", value: bookings.length, accent: "#17222F" },
          { label: "Archived", value: archivedCount, accent: "#9AA0AD" },
        ]}
      />

      <div className="bg-[#FFFFFF] border border-[#17222F] rounded-none overflow-x-auto transition-colors hover:border-[#E5322B] duration-300 animate-fade-up">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead className="bg-[#F2F2F2] text-[14px] text-[#5A6473] border-b border-[#17222F]">
            <tr>
              <th className="p-5 font-semibold">Contact</th>
              <th className="p-5 font-semibold">Stage & Need</th>
              <th className="p-5 font-semibold">Service</th>
              <th className="p-5 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#17222F]">
            {bookings.map((b) => (
              <tr key={b.id} onClick={() => setSelectedLead(b)} className="hover:bg-[#FFFFFF] transition-colors cursor-pointer group">
                <td className="p-5">
                  <div className="font-semibold text-[#17222F] text-[15.5px]">{b.name}</div>
                  <div className="text-[14px] text-[#5A6473] mt-1">{b.email}</div>
                  <div className="text-[14px] text-[#5A6473]">{b.phone}</div>
                </td>
                <td className="p-5 max-w-[280px]">
                  <div className="font-semibold text-[14.5px] text-[#17222F] mb-1">{b.stage}</div>
                  <div className="text-[14px] text-[#5A6473] truncate group-hover:whitespace-normal transition-all" title={b.problem}>{b.problem}</div>
                </td>
                <td className="p-5">
                  <span className="bg-[#F2F2F2] text-[#E5322B] border border-[#E5322B] border-opacity-20 px-3 py-1.5 rounded-none text-[12px] font-semibold font-mono">
                    {b.service || "—"}
                  </span>
                </td>
                <td className="p-5">
                  <span className={`px-3 py-1.5 rounded-none text-[12px] font-semibold font-mono border ${
                    (b.status === "new" || b.status === "New") ? "bg-[#FBE9E7] text-[#E5322B] border-[#E5322B] border-opacity-20" : b.status === "Converted" ? "bg-[#E6F6EF] text-[#0F9D6B] border-[#0F9D6B] border-opacity-20" : "bg-[#F2F2F2] text-[#5A6473] border-[#17222F]"
                  }`}>
                    {b.status || "New"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#17222F] bg-opacity-40 backdrop-blur-sm">
          <div className="bg-[#FFFFFF] w-full max-w-2xl border border-[#17222F] rounded-none overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="px-6 py-5 md:px-8 md:py-6 border-b border-[#17222F] flex justify-between items-center bg-[#FFFFFF]">
              <div>
                <div className="font-mono text-[11px] text-[#E5322B] uppercase font-semibold mb-1">Lead Details</div>
                <h2 className="text-[20px] md:text-[22px] font-bold text-[#17222F] leading-none">{selectedLead.name}</h2>
              </div>
              <button onClick={() => setSelectedLead(null)} className="w-8 h-8 flex items-center justify-center rounded-none bg-[#17222F] text-[#5A6473] hover:bg-[#17222F]">
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>

            <div className="p-6 md:p-8 overflow-y-auto flex-1 text-[15px] space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div><div className="font-mono text-[11px] text-[#9AA0AD] uppercase mb-1">Email</div><div className="font-medium text-[#17222F] break-all">{selectedLead.email}</div></div>
                <div><div className="font-mono text-[11px] text-[#9AA0AD] uppercase mb-1">Phone</div><div className="font-medium text-[#17222F]">{selectedLead.phone || "N/A"}</div></div>
                <div><div className="font-mono text-[11px] text-[#9AA0AD] uppercase mb-1">Company</div><div className="font-medium text-[#17222F]">{selectedLead.company || "N/A"}</div></div>
                <div><div className="font-mono text-[11px] text-[#9AA0AD] uppercase mb-1">Service</div><div className="font-medium text-[#17222F]">{selectedLead.service || "—"}</div></div>
              </div>
              <div><div className="font-mono text-[11px] text-[#9AA0AD] uppercase mb-2">Stage</div><div className="inline-block bg-[#F2F2F2] border border-[#17222F] px-3 py-1.5 rounded-none text-[#2E3744] font-medium text-[14px]">{selectedLead.stage}</div></div>
              <div><div className="font-mono text-[11px] text-[#9AA0AD] uppercase mb-2">The Problem</div><div className="bg-[#F2F2F2] border border-[#17222F] p-4 md:p-5 rounded-none text-[#2E3744] leading-relaxed">{selectedLead.problem}</div></div>
            </div>

            <div className="p-4 md:p-6 border-t border-[#17222F] bg-[#FFFFFF] flex flex-col-reverse md:flex-row justify-between items-center gap-3">
              {canWrite ? (
                <>
                  <button onClick={handleArchiveLead} className="w-full md:w-auto justify-center flex items-center gap-2 text-[#5A6473] font-semibold text-[14.5px] hover:text-[#E5322B] px-4 py-3 md:py-2">
                    <Trash2 size={16} /> Archive Lead
                  </button>

                  {(selectedLead.status === "new" || selectedLead.status === "New") ? (
                    <button onClick={handleSendToPipeline} disabled={isProcessing} className="w-full md:w-auto justify-center bg-[#E5322B] text-white px-6 py-3.5 md:py-3 rounded-none font-semibold text-[15px] flex items-center gap-2 hover:-translate-y-0.5 transition-transform">
                      {isProcessing ? "Processing..." : "Approve to Pipeline"} {!isProcessing && <Layers size={18} />}
                    </button>
                  ) : (
                    <button disabled className="w-full md:w-auto justify-center bg-[#17222F] text-[#9AA0AD] px-6 py-3 rounded-none font-semibold text-[15px] flex items-center gap-2 cursor-not-allowed">
                      Status: {selectedLead.status}
                    </button>
                  )}
                </>
              ) : (
                <p className="w-full text-center font-mono text-[12.5px] text-[#9AA0AD] py-1">You have read-only access to leads.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}