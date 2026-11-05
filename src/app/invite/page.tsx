'use client';

import { useEffect, useState } from 'react';
import { LogoMark } from '@/components/Logo';

/** Landing for a team invite link: keeps the invite, then sends you to sign in. */
export default function InvitePage() {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token') ?? '';
    if (/^[a-f0-9]{64}$/.test(token)) {
      try { localStorage.setItem('sv_invite_token', token); } catch { /* storage blocked */ }
      setOk(true);
    } else setOk(false);
  }, []);
  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="flex justify-center"><LogoMark px={56} tile /></div>
        {ok === false ? (
          <>
            <h1 className="font-display text-3xl">This invite link isn&apos;t complete</h1>
            <p className="text-muted-foreground">Open the link from your invite email again, or ask your admin to send a new one.</p>
          </>
        ) : (
          <>
            <h1 className="font-display text-3xl">You&apos;re invited to SecureVoult</h1>
            <p className="text-muted-foreground">Sign in, or create your account, with the email address the invite was sent to. You&apos;ll join your team straight after.</p>
            <a href="/#/signin" className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-6 font-semibold text-primary-foreground">Continue</a>
          </>
        )}
      </div>
    </main>
  );
}
