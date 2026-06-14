import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "./firebase";

// The currently signed-in member, set by the auth provider (carries the
// member's display name). We also fall back to the live Firebase auth user so
// attribution never degrades to "Unknown" if this hasn't been set yet (e.g. an
// action fires before the member doc resolves, or after a dev HMR reset).
let actor: { uid: string; email: string; name: string } | null = null;

export function setAuditActor(a: { uid: string; email: string; name: string } | null) {
  actor = a;
}

function current(): { uid: string; email: string; name: string } | null {
  if (actor && (actor.name || actor.email)) return actor;
  const u = auth.currentUser;
  if (u) return { uid: u.uid, email: u.email || "", name: u.displayName || u.email || "" };
  return actor;
}

// Display name of the current actor, for attributing notes/timeline entries.
export function actorLabel(): string {
  const a = current();
  return a?.name || a?.email || "Someone";
}

// Append an entry to the audit trail. Best-effort: logging must never block or
// break the underlying action, so failures are swallowed with a console warning.
// `targetId` ties the entry to a specific record (e.g. a lead) so it can be
// shown in that record's own activity timeline.
export async function logAction(action: string, details = "", targetId?: string) {
  const a = current();
  try {
    await addDoc(collection(db, "auditLogs"), {
      action,
      details,
      targetId: targetId ?? null,
      actorUid: a?.uid ?? "system",
      actorEmail: a?.email ?? "unknown",
      actorName: a?.name || a?.email || "Unknown",
      at: serverTimestamp(),
    });
  } catch (e) {
    console.error("audit log failed", e);
  }
}
