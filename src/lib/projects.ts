import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { logAction } from "./audit";

// ── Types ───────────────────────────────────────────────────────────────────
export type StageState = "pending" | "active" | "done";

export interface Stage {
  id: string;
  name: string;
  description?: string;
  state: StageState;
}

export type MilestoneStatus = "due" | "paid";

export interface Milestone {
  id: string;
  label: string;
  amount: number; // in INR (rupees) — derived from percent × project total
  percent?: number; // share of the project total, if created by percentage
  stageId?: string; // optional link to a stage
  status: MilestoneStatus;
  razorpayPaymentId?: string;
  paidAt?: number; // ms epoch
}

// amount (rounded ₹) for a percentage of the project total.
export const amountFromPercent = (total: number, percent: number): number =>
  Math.round((total * percent) / 100);

export type FieldType =
  | "text" | "textarea" | "number" | "email"
  | "select" | "multiselect" | "checkbox" | "date";

export interface Field {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[]; // for select / multiselect
  placeholder?: string;
}

export interface RequirementForm {
  fields: Field[];
}

export type ProjectStatus = "active" | "on_hold" | "completed";
export type RequirementStatus = "draft" | "pending" | "submitted";

export interface Project {
  id: string;
  title: string;
  clientId?: string;
  clientName: string;
  clientEmail?: string;
  clientUid?: string; // linked portal login uid
  status: ProjectStatus;
  totalAmount?: number; // total project value (₹); milestones are % of this
  members: string[]; // member uids
  stages: Stage[];
  currentStageId?: string | null;
  paymentMilestones: Milestone[];
  requirementForm: RequirementForm;
  requirementResponses?: Record<string, any> | null;
  requirementStatus: RequirementStatus;
  requirementSubmittedAt?: number | null;
  dueDate?: string;
  createdAt?: any;
  createdBy?: string;
  updatedAt?: any;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
export const genId = (): string =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Long text" },
  { value: "number", label: "Number" },
  { value: "email", label: "Email" },
  { value: "select", label: "Dropdown" },
  { value: "multiselect", label: "Multi-select" },
  { value: "checkbox", label: "Checkbox" },
  { value: "date", label: "Date" },
];

// Sensible starter stages + a small starter requirement form for new projects.
export function defaultStages(): Stage[] {
  return [
    { id: genId(), name: "Discovery", description: "Understand goals & requirements.", state: "active" },
    { id: genId(), name: "Design", description: "Shape the solution & UX.", state: "pending" },
    { id: genId(), name: "Build", description: "Engineer the working product.", state: "pending" },
    { id: genId(), name: "Review", description: "Test, refine & sign-off.", state: "pending" },
    { id: genId(), name: "Launch", description: "Ship & hand over.", state: "pending" },
  ];
}

export function defaultRequirementForm(): RequirementForm {
  return {
    fields: [
      { id: genId(), label: "What are you building?", type: "textarea", required: true, placeholder: "Describe the project in a few lines." },
      { id: genId(), label: "Primary goal", type: "text", required: true, placeholder: "e.g. Launch an MVP in 6 weeks" },
      { id: genId(), label: "Budget range", type: "select", required: false, options: ["< ₹1L", "₹1L–₹5L", "₹5L–₹10L", "₹10L+"] },
      { id: genId(), label: "Target launch date", type: "date", required: false },
    ],
  };
}

// ── Writes ──────────────────────────────────────────────────────────────────
export async function createProject(input: {
  title: string;
  clientId?: string;
  clientName: string;
  clientEmail?: string;
  dueDate?: string;
  createdBy?: string;
}): Promise<string> {
  const stages = defaultStages();
  const ref = await addDoc(collection(db, "projects"), {
    title: input.title,
    clientId: input.clientId ?? null,
    clientName: input.clientName,
    clientEmail: input.clientEmail ?? "",
    clientUid: null,
    status: "active" as ProjectStatus,
    totalAmount: 0,
    members: [],
    stages,
    currentStageId: stages[0]?.id ?? null,
    paymentMilestones: [],
    requirementForm: defaultRequirementForm(),
    requirementResponses: null,
    requirementStatus: "draft" as RequirementStatus,
    requirementSubmittedAt: null,
    dueDate: input.dueDate || "",
    createdAt: serverTimestamp(),
    createdBy: input.createdBy ?? null,
    updatedAt: serverTimestamp(),
  });
  await logAction("Created project", `${input.title} — ${input.clientName}`, ref.id);
  return ref.id;
}

// Generic patch — always stamps updatedAt.
export async function updateProject(id: string, patch: Partial<Project>) {
  await updateDoc(doc(db, "projects", id), { ...patch, updatedAt: serverTimestamp() } as any);
}

export async function deleteProject(id: string, title: string) {
  await deleteDoc(doc(db, "projects", id));
  await logAction("Deleted project", title, id);
}

// Recompute currentStageId = first active stage, else first pending, else last.
export function deriveCurrentStage(stages: Stage[]): string | null {
  const active = stages.find((s) => s.state === "active");
  if (active) return active.id;
  const pending = stages.find((s) => s.state === "pending");
  if (pending) return pending.id;
  return stages[stages.length - 1]?.id ?? null;
}

export async function saveStages(id: string, stages: Stage[]) {
  await updateProject(id, { stages, currentStageId: deriveCurrentStage(stages) });
}

export async function setStageState(project: Project, stageId: string, state: StageState) {
  const stages = project.stages.map((s) => (s.id === stageId ? { ...s, state } : s));
  await saveStages(project.id, stages);
  const st = stages.find((s) => s.id === stageId);
  await logAction("Updated project stage", `${project.title}: ${st?.name} → ${state}`, project.id);
}

export async function saveMilestones(id: string, paymentMilestones: Milestone[]) {
  await updateProject(id, { paymentMilestones });
}

// Mark a milestone paid (manual mark by staff, or after a Razorpay success).
export async function recordPayment(project: Project, milestoneId: string, razorpayPaymentId?: string) {
  const paymentMilestones = project.paymentMilestones.map((m) =>
    m.id === milestoneId ? { ...m, status: "paid" as MilestoneStatus, razorpayPaymentId: razorpayPaymentId || m.razorpayPaymentId || "manual", paidAt: Date.now() } : m
  );
  await saveMilestones(project.id, paymentMilestones);
  const m = paymentMilestones.find((x) => x.id === milestoneId);
  await logAction("Recorded payment", `${project.title}: ${m?.label} (₹${m?.amount})`, project.id);
}

export async function saveRequirementForm(id: string, form: RequirementForm) {
  await updateProject(id, { requirementForm: form });
}

export async function sendRequirementForm(project: Project) {
  await updateProject(project.id, { requirementStatus: "pending" });
  await logAction("Sent requirement form", project.title, project.id);
}

// Client-side: submit the filled requirement responses.
export async function submitRequirements(projectId: string, responses: Record<string, any>) {
  await updateDoc(doc(db, "projects", projectId), {
    requirementResponses: responses,
    requirementStatus: "submitted",
    requirementSubmittedAt: Date.now(),
    updatedAt: serverTimestamp(),
  });
}

export const stageProgress = (stages: Stage[]): { done: number; total: number; pct: number } => {
  const total = stages.length || 1;
  const done = stages.filter((s) => s.state === "done").length;
  return { done, total: stages.length, pct: Math.round((done / total) * 100) };
};
