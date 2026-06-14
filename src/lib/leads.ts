import { collection, addDoc, updateDoc, doc, serverTimestamp, arrayUnion } from "firebase/firestore";
import { db } from "./firebase";
import { logAction, actorLabel } from "./audit";
import type { PipelineStage } from "../pages/Settings";

// A single entry in a lead's notes/follow-up timeline (stored on the booking doc).
export interface LeadNote {
  type: "stage" | "followup" | "done" | "edit";
  text: string;
  stage?: string;
  date?: string; // for follow-ups: the scheduled / completed date
  author: string;
  at: number; // ms epoch (serverTimestamp can't be used inside arrayUnion)
}

export function leadNote(type: LeadNote["type"], opts: { text?: string; stage?: string; date?: string } = {}): LeadNote {
  return { type, text: opts.text || "", stage: opts.stage || "", date: opts.date || "", author: actorLabel(), at: Date.now() };
}

// Append an entry to a lead's timeline.
export async function addLeadNote(leadId: string, entry: LeadNote) {
  await updateDoc(doc(db, "bookings", leadId), { notes: arrayUnion(entry) });
}

// Advance a lead to a new pipeline stage, optionally attaching a stage note for
// the lead's activity trail. Reaching the final stage promotes the lead into the
// CRM exactly once; leaving a follow-up stage clears its reminder.
// Shared by the pipeline board, the lead drawer and the dashboard.
export async function advanceLeadStatus(lead: any, targetStage: string, stages: PipelineStage[], note = "") {
  const finalStageName = stages[stages.length - 1]?.name;
  const targetObj = stages.find((s) => s.name === targetStage);
  const suffix = note ? ` — “${note}”` : "";

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
    await updateDoc(doc(db, "bookings", lead.id), {
      status: targetStage, convertedToClient: true, followUpDate: null, lastStageNote: note || null,
      notes: arrayUnion(leadNote("stage", { stage: targetStage, text: note })),
    });
    await logAction("Converted lead to client", `${lead.name} (${targetStage})${suffix}`, lead.id);
  } else {
    await updateDoc(doc(db, "bookings", lead.id), {
      status: targetStage,
      followUpDate: targetObj?.isFollowUp ? lead.followUpDate || null : null,
      lastStageNote: note || null,
      notes: arrayUnion(leadNote("stage", { stage: targetStage, text: note })),
    });
    await logAction("Moved lead", `${lead.name} → ${targetStage}${suffix}`, lead.id);
  }
}
