import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

// The currently signed-in member, set by the auth provider so any mutation can
// attribute itself without prop-drilling the user through every component.
let actor: { uid: string; email: string; name: string } | null = null;

export function setAuditActor(a: { uid: string; email: string; name: string } | null) {
  actor = a;
}

// Append an entry to the audit trail. Best-effort: logging must never block or
// break the underlying action, so failures are swallowed with a console warning.
export async function logAction(action: string, details = "") {
  try {
    await addDoc(collection(db, "auditLogs"), {
      action,
      details,
      actorUid: actor?.uid ?? "system",
      actorEmail: actor?.email ?? "unknown",
      actorName: actor?.name || actor?.email || "Unknown",
      at: serverTimestamp(),
    });
  } catch (e) {
    console.error("audit log failed", e);
  }
}
