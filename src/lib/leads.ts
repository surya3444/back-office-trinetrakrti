import { collection, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { logAction } from "./audit";
import type { PipelineStage } from "../pages/Settings";

// Advance a lead to a new pipeline stage. Reaching the final stage promotes the
// lead into the CRM exactly once; leaving a follow-up stage clears its reminder.
// Shared by the pipeline board and the dashboard so the rules never diverge.
export async function advanceLeadStatus(lead: any, targetStage: string, stages: PipelineStage[]) {
  const finalStageName = stages[stages.length - 1]?.name;
  const targetObj = stages.find((s) => s.name === targetStage);

  if (targetStage === finalStageName && !lead.convertedToClient) {
    await addDoc(collection(db, "clients"), {
      name: lead.name,
      company: lead.company || "N/A",
      email: lead.email,
      phone: lead.phone || "N/A",
      status: "Active",
      value: "",
      sourceLeadId: lead.id,
      createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, "bookings", lead.id), { status: targetStage, convertedToClient: true, followUpDate: null });
    await logAction("Converted lead to client", `${lead.name} (${targetStage})`);
  } else {
    await updateDoc(doc(db, "bookings", lead.id), {
      status: targetStage,
      followUpDate: targetObj?.isFollowUp ? lead.followUpDate || null : null,
    });
    await logAction("Moved lead", `${lead.name} → ${targetStage}`);
  }
}
