import "server-only";
import { isEmailConfigured } from "@/lib/auth";

// One plain message through Resend, the same account that already sends the
// sign-in link (AUTH_RESEND_KEY / AUTH_RESEND_FROM). A fetch rather than a
// client library, like Auth.js's own provider. RESEND_API_URL exists so a
// test can point this at a local stand-in; it is never set in production.
export async function sendEmail({ to, subject, text, html }) {
  if (!isEmailConfigured()) throw new Error("Email is not configured.");
  const base = process.env.RESEND_API_URL || "https://api.resend.com";
  const response = await fetch(`${base}/emails`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.AUTH_RESEND_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: process.env.AUTH_RESEND_FROM, to: [to], subject, text, html }),
  });
  if (!response.ok) {
    throw new Error(`Email service answered ${response.status}.`);
  }
}
