/**
 * Two-step sign-in (authenticator app).
 *
 *   GET  /api/auth/2fa/status        { enabled, verified, backupCodesLeft }
 *   POST /api/auth/2fa/setup         start: { otpauth, secret }          (not yet on)
 *   POST /api/auth/2fa/enable        { code } → { token, backupCodes }   (turns it on)
 *   POST /api/auth/2fa/verify        { code } → { token }  code = 6 digits or a backup code
 *   POST /api/auth/2fa/disable       { code }
 *   POST /api/auth/2fa/backup-codes  { code } → { backupCodes }          (new set)
 */
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db-connect';
import { User } from '@/lib/models';
import { requireAuthenticatedUser } from '@/lib/server-auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import {
  checkMfaToken, checkTotp, issueMfaToken, matchBackupCode, newBackupCodes, newTotpSecret, openSecret,
  otpauthUri, sealSecret,
} from '@/lib/mfa';

type Mfa = { enabled?: boolean; secretEnc?: string | null; pendingSecretEnc?: string | null; lastStep?: number | null; backupCodes?: string[] };

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const fail = (status: number, code: string, message: string) => json({ error: true, code, message }, status);

export async function GET(request: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  if (action !== 'status') return fail(404, 'not_found', 'Not found');
  const auth = await requireAuthenticatedUser(request);
  if ('error' in auth) return auth.error;
  await connectDB();
  const doc = await User.findOne({ firebaseUid: auth.user.uid }).select('mfa').lean() as { mfa?: Mfa } | null;
  const enabled = !!doc?.mfa?.enabled;
  return json({
    enabled,
    verified: !enabled || checkMfaToken(request.headers.get('x-mfa-token'), auth.user.uid, auth.user.authTime),
    backupCodesLeft: enabled ? doc?.mfa?.backupCodes?.length ?? 0 : 0,
  });
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  const auth = await requireAuthenticatedUser(request);
  if ('error' in auth) return auth.error;
  const { uid, email, authTime } = auth.user;

  // 10 tries per 15 minutes per account and per address: a 6-digit code can't be guessed.
  for (const id of [`uid:${uid}`, `ip:${getClientIp(request)}`]) {
    const rl = await checkRateLimit(id, { key: 'mfa', limit: 10, windowMs: 15 * 60 * 1000 });
    if (!rl.allowed) return fail(429, 'rate_limited', 'Too many attempts. Wait a few minutes and try again.');
  }

  let body: { code?: string } = {};
  try { body = await request.json(); } catch { /* setup has no body */ }
  const code = String(body.code ?? '').trim();

  await connectDB();
  const user = await User.findOne({ firebaseUid: uid });
  if (!user) return fail(404, 'no_user', 'Sign in again and retry.');
  const mfa: Mfa = user.mfa ?? {};

  const checkCode = (allowBackup: boolean): boolean => {
    if (!mfa.secretEnc) return false;
    const step = checkTotp(openSecret(mfa.secretEnc), code, mfa.lastStep);
    if (step !== null) { user.set('mfa.lastStep', step); return true; }
    if (allowBackup) {
      const i = matchBackupCode(code, mfa.backupCodes ?? []);
      if (i >= 0) { user.set('mfa.backupCodes', (mfa.backupCodes ?? []).filter((_, j) => j !== i)); return true; }
    }
    return false;
  };

  switch (action) {
    case 'setup': {
      if (mfa.enabled) return fail(409, 'already_on', 'Two-step sign-in is already on.');
      const secret = newTotpSecret();
      user.set('mfa.pendingSecretEnc', sealSecret(secret));
      await user.save();
      return json({ secret, otpauth: otpauthUri(secret, email) });
    }

    case 'enable': {
      if (mfa.enabled) return fail(409, 'already_on', 'Two-step sign-in is already on.');
      if (!mfa.pendingSecretEnc) return fail(400, 'no_setup', 'Start the setup again.');
      const secret = openSecret(mfa.pendingSecretEnc);
      const step = checkTotp(secret, code, null);
      if (step === null) return fail(400, 'wrong_code', 'That code is not right. Check the time on your phone and try the newest code.');
      const codes = newBackupCodes();
      user.set('mfa', { enabled: true, secretEnc: mfa.pendingSecretEnc, pendingSecretEnc: null, lastStep: step, backupCodes: codes.hashed, enabledAt: new Date() });
      await user.save();
      return json({ token: authTime ? issueMfaToken(uid, authTime) : null, backupCodes: codes.plain });
    }

    case 'verify': {
      if (!mfa.enabled) return json({ token: null, enabled: false });
      if (!authTime) return fail(400, 'no_session', 'Sign in again and retry.');
      if (!checkCode(true)) return fail(400, 'wrong_code', 'That code is not right.');
      await user.save();
      return json({ token: issueMfaToken(uid, authTime), backupCodesLeft: (user.mfa?.backupCodes ?? []).length });
    }

    case 'disable': {
      if (!mfa.enabled) return json({ ok: true });
      if (!checkCode(true)) return fail(400, 'wrong_code', 'That code is not right.');
      user.set('mfa', { enabled: false, secretEnc: null, pendingSecretEnc: null, lastStep: null, backupCodes: [], enabledAt: null });
      await user.save();
      return json({ ok: true });
    }

    case 'backup-codes': {
      if (!mfa.enabled) return fail(400, 'not_on', 'Turn on two-step sign-in first.');
      if (!checkCode(false)) return fail(400, 'wrong_code', 'Enter a current code from your authenticator app.');
      const codes = newBackupCodes();
      user.set('mfa.backupCodes', codes.hashed);
      await user.save();
      return json({ backupCodes: codes.plain });
    }
  }
  return fail(404, 'not_found', 'Not found');
}
