import { recordPayment, type Project, type Milestone } from "./projects";

// Razorpay test/dummy integration.
//
// This is a front-end-only app (no backend), so we cannot create a real
// server-side order or verify the payment signature. In TEST mode that's fine:
// we open Razorpay's real checkout with a test `key_id`, and on the client-side
// success callback we record the payment to Firestore.
//
// If no test key is configured (VITE_RAZORPAY_KEY_ID), we fall back to a
// simulated success so the flow is fully demonstrable offline.

const KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined;
const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

declare global {
  interface Window {
    Razorpay?: any;
  }
}

let loaderPromise: Promise<boolean> | null = null;

// Inject the Razorpay checkout script once; resolves false if it can't load.
export function loadCheckout(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  if (loaderPromise) return loaderPromise;
  loaderPromise = new Promise<boolean>((resolve) => {
    const s = document.createElement("script");
    s.src = CHECKOUT_SRC;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
  return loaderPromise;
}

export const hasRazorpayKey = (): boolean => !!KEY_ID;

export interface PayResult {
  ok: boolean;
  paymentId?: string;
  simulated?: boolean;
  error?: string;
}

// Open the Razorpay test checkout for a milestone. On success the milestone is
// recorded as paid on the project doc. Returns a PayResult.
export async function payMilestone(project: Project, milestone: Milestone): Promise<PayResult> {
  // No key configured → simulated dummy payment.
  if (!KEY_ID) {
    const paymentId = `sim_${Date.now().toString(36)}`;
    await recordPayment(project, milestone.id, paymentId);
    return { ok: true, paymentId, simulated: true };
  }

  const loaded = await loadCheckout();
  if (!loaded || !window.Razorpay) {
    return { ok: false, error: "Could not load Razorpay checkout. Check your connection." };
  }

  return new Promise<PayResult>((resolve) => {
    const rzp = new window.Razorpay({
      key: KEY_ID,
      amount: Math.round(milestone.amount * 100), // paise
      currency: "INR",
      name: "Trinetrakrti",
      description: `${project.title} — ${milestone.label}`,
      prefill: { name: project.clientName, email: project.clientEmail || "" },
      notes: { projectId: project.id, milestoneId: milestone.id },
      theme: { color: "#E5322B" },
      handler: async (resp: { razorpay_payment_id: string }) => {
        try {
          await recordPayment(project, milestone.id, resp.razorpay_payment_id);
          resolve({ ok: true, paymentId: resp.razorpay_payment_id });
        } catch (e) {
          resolve({ ok: false, error: "Payment captured but could not be saved. Contact support." });
        }
      },
      modal: { ondismiss: () => resolve({ ok: false, error: "Payment cancelled." }) },
    });
    rzp.on("payment.failed", (r: any) => resolve({ ok: false, error: r?.error?.description || "Payment failed." }));
    rzp.open();
  });
}
