/**
 * Sends email through the same SMTP server as the Autisync CRM
 * (mail.autisync.com). Set in .env.local, copied to the server by deploy.ps1:
 *
 *   SMTP_HOST      mail.autisync.com
 *   SMTP_PORT      587 (STARTTLS) or 465 (TLS). Default 587.
 *   SMTP_USER      the mailbox to sign in as
 *   SMTP_PASSWORD  its password
 *   SMTP_SECURE    true forces TLS on connect; default: true on port 465
 *   MAIL_FROM      optional, e.g. "SecureVoult <security@autisync.com>"; default: SMTP_USER
 *
 * With no SMTP_HOST, nothing is sent and callers are told so (never thrown).
 */
import nodemailer, { type Transporter } from 'nodemailer';

const env = (k: string) => (process.env[k] ?? '').trim();

let transporter: Transporter | null = null;

export function mailConfigured(): boolean {
  return !!env('SMTP_HOST') && !!env('SMTP_USER') && !!env('SMTP_PASSWORD');
}

function transport(): Transporter {
  if (transporter) return transporter;
  const port = Number(env('SMTP_PORT') || 587);
  transporter = nodemailer.createTransport({
    host: env('SMTP_HOST'),
    port,
    secure: env('SMTP_SECURE') ? env('SMTP_SECURE') === 'true' : port === 465,
    auth: { user: env('SMTP_USER'), pass: env('SMTP_PASSWORD') },
    tls: { rejectUnauthorized: env('SMTP_REJECT_UNAUTHORIZED') !== 'false' },
  });
  return transporter;
}

export interface Mail { to: string | string[]; subject: string; text: string; html?: string }

export async function sendMail(mail: Mail): Promise<{ sent: boolean; error?: string }> {
  if (!mailConfigured()) return { sent: false, error: 'Email is not set up (SMTP_HOST, SMTP_USER, SMTP_PASSWORD)' };
  try {
    await transport().sendMail({
      from: env('MAIL_FROM') || `SecureVoult <${env('SMTP_USER')}>`,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html ?? brandedHtml(mail.subject, mail.text),
    });
    return { sent: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[mailer] send failed:', error);
    return { sent: false, error };
  }
}

/** Checks the SMTP login without sending anything. */
export async function verifyMail(): Promise<{ ok: boolean; detail: string }> {
  if (!mailConfigured()) return { ok: false, detail: 'Not set up: add SMTP_HOST, SMTP_USER and SMTP_PASSWORD' };
  try { await transport().verify(); return { ok: true, detail: `Connected to ${env('SMTP_HOST')}` }; }
  catch (e) { return { ok: false, detail: e instanceof Error ? e.message : String(e) }; }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Plain, readable HTML in the SecureVoult look. Lines become paragraphs. */
export function brandedHtml(title: string, text: string, button?: { label: string; url: string }): string {
  const paras = text.split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px;line-height:1.55">${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
  const btn = button ? `<p style="margin:22px 0"><a href="${esc(button.url)}" style="background:#CDA24C;color:#1a1408;text-decoration:none;font-weight:600;padding:11px 18px;border-radius:10px;display:inline-block">${esc(button.label)}</a></p>` : '';
  return `<!doctype html><html><body style="margin:0;background:#f4f2ee;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1c1b19">
<div style="max-width:560px;margin:0 auto;padding:28px 18px">
<div style="font-weight:700;font-size:17px;margin-bottom:18px">Secure<span style="color:#A9802F">Voult</span></div>
<div style="background:#fff;border:1px solid #e6e1d6;border-radius:14px;padding:24px">
<h1 style="font-size:19px;margin:0 0 14px">${esc(title)}</h1>${paras}${btn}</div>
<p style="font-size:12px;color:#7a756b;margin-top:16px">SecureVoult by Autisync · vault.autisync.com. We will never ask for your master password or recovery key.</p>
</div></body></html>`;
}
