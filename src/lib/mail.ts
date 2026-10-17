import nodemailer, { Transporter } from "nodemailer";

let transport: Transporter | null = null;
const configured = () => !!process.env.SMTP_HOST;

function getTransport() {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transport;
}

const appUrl = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

function layout(title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#EEF2F6;font-family:Arial,Helvetica,sans-serif;color:#172033">
  <div style="max-width:520px;margin:32px auto;background:#fff;border:1px solid #D6DDE6;border-radius:14px;padding:28px">
  <div style="font-weight:700;font-size:18px;color:#0E6B66;margin-bottom:16px">FlipAdmit</div>
  <h1 style="font-size:20px;margin:0 0 12px">${title}</h1>${body}
  <p style="font-size:12px;color:#6B7686;margin-top:28px">You received this because of activity on your FlipAdmit account.</p></div></body></html>`;
}

/** Sends with Nodemailer when SMTP is configured; otherwise prints the message to the server console (development). */
export async function sendMail(to: string, subject: string, title: string, bodyHtml: string, text: string) {
  if (!configured()) {
    console.log(`\n[mail:dev] To: ${to}\n[mail:dev] Subject: ${subject}\n[mail:dev] ${text}\n`);
    return { delivered: false };
  }
  try {
    await getTransport().sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, html: layout(title, bodyHtml), text });
    return { delivered: true };
  } catch (e) {
    console.error("[mail] send failed:", (e as Error).message);
    return { delivered: false };
  }
}
export const mailConfigured = configured;

export const mails = {
  otp: (to: string, code: string, purpose: "verify_email" | "login") =>
    sendMail(to, purpose === "login" ? `Your FlipAdmit sign-in code: ${code}` : `Verify your email: ${code}`,
      purpose === "login" ? "Your sign-in code" : "Verify your email",
      `<p>Enter this code to ${purpose === "login" ? "finish signing in" : "verify your email address"}. It expires in 10 minutes.</p>
       <p style="font-size:32px;letter-spacing:8px;font-weight:700;margin:20px 0">${code}</p>`,
      `Your code is ${code}. It expires in 10 minutes.`),
  reset: (to: string, token: string) => {
    const link = `${appUrl()}/reset-password?token=${token}`;
    return sendMail(to, "Reset your FlipAdmit password", "Reset your password",
      `<p>Use the button below to choose a new password. The link expires in 1 hour.</p>
       <p><a href="${link}" style="display:inline-block;background:#0E6B66;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none">Choose a new password</a></p>
       <p style="font-size:12px;color:#6B7686">If you didn't ask for this, ignore this email.</p>`,
      `Reset your password: ${link}`);
  },
  newOffer: (to: string, uni: string, course: string, raised: boolean) =>
    sendMail(to, raised ? `${uni} raised its offer` : `New offer from ${uni}`, raised ? "An offer just went up" : "You have a new offer",
      `<p>${uni} ${raised ? "raised its offer" : "made you an offer"} for <strong>${course}</strong>.</p>
       <p><a href="${appUrl()}/student/offers" style="color:#0E6B66">Review your offers</a></p>`,
      `${uni} ${raised ? "raised its offer" : "made you an offer"} for ${course}. ${appUrl()}/student/offers`),
  decision: (to: string, student: string, course: string, accepted: boolean) =>
    sendMail(to, accepted ? `${student} accepted your offer` : `${student} declined your offer`,
      accepted ? "Offer accepted" : "Offer declined",
      `<p>${student} ${accepted ? "accepted" : "declined"} your offer for <strong>${course}</strong>.${accepted ? " One seat is now filled." : " The funding has been returned to your course budget."}</p>
       <p><a href="${appUrl()}/university/bids" style="color:#0E6B66">Open your bid dashboard</a></p>`,
      `${student} ${accepted ? "accepted" : "declined"} your offer for ${course}.`),
};
