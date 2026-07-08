/**
 * Auth email templates (docs: "Verification Email Template"). Plain functions
 * returning subject + text + minimal HTML. Links point at the frontend routes
 * (`/auth/verify-email`, `/auth/reset-password`), which then call the API — the
 * raw token travels only in the link, never persisted in plaintext (docs 13 §13).
 */
export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

function layout(heading: string, body: string, cta: { label: string; url: string }): string {
  return [
    `<div style="font-family:Inter,system-ui,sans-serif;max-width:520px;margin:auto;color:#24211b">`,
    `<h1 style="font-family:Lora,Georgia,serif;font-size:24px">${heading}</h1>`,
    `<p style="font-size:16px;line-height:1.6">${body}</p>`,
    `<p><a href="${cta.url}" style="display:inline-block;padding:12px 20px;background:#9e4b28;color:#fff;border-radius:6px;text-decoration:none">${cta.label}</a></p>`,
    `<p style="font-size:13px;color:#6b655a">If the button doesn't work, paste this link into your browser:<br>${cta.url}</p>`,
    `</div>`,
  ].join('');
}

export function verificationEmail(appUrl: string, rawToken: string): EmailContent {
  const url = `${appUrl}/auth/verify-email?token=${encodeURIComponent(rawToken)}`;
  return {
    subject: 'Verify your Qalam email',
    text: `Welcome to Qalam. Verify your email within 24 hours: ${url}`,
    html: layout(
      'Verify your email',
      'Welcome to Qalam — a premium writing sanctuary. Confirm your email address to start writing. This link expires in 24 hours.',
      { label: 'Verify email', url },
    ),
  };
}

export function passwordResetEmail(appUrl: string, rawToken: string): EmailContent {
  const url = `${appUrl}/auth/reset-password?token=${encodeURIComponent(rawToken)}`;
  return {
    subject: 'Reset your Qalam password',
    text: `Reset your Qalam password within 60 minutes: ${url}. If you didn't request this, ignore this email.`,
    html: layout(
      'Reset your password',
      "We received a request to reset your password. This link expires in 60 minutes. If you didn't request it, you can safely ignore this email.",
      { label: 'Reset password', url },
    ),
  };
}
