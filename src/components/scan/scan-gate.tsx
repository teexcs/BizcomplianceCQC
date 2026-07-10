'use client';

import { useState } from 'react';
import { Mail, LockOpen, FileDown } from 'lucide-react';
import { Input } from '@/components/ui/input';

/**
 * The Experian-style unlock rail on scan results.
 *
 * State 1 (no email yet): "enter your email to receive your free report".
 * State 2 (email captured): the banner becomes the £8.99 full-report offer.
 * State 3 (paid): download button — handled by the page, not this component.
 */
export function ScanGate({
  scanId,
  initialEmailCaptured,
}: {
  scanId: string;
  initialEmailCaptured: boolean;
}) {
  const [emailCaptured, setEmailCaptured] = useState(initialEmailCaptured);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/scan/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scanId, email }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? 'Something went wrong — try again.');
      } else {
        setEmailCaptured(true);
      }
    } catch {
      setError('Network error — try again.');
    }
    setBusy(false);
  }

  async function buyReport() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/scan/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scanId }),
      });
      const json = (await res.json()) as { ok?: boolean; url?: string; error?: string; alreadyPaid?: boolean };
      if (json.alreadyPaid) {
        window.location.reload();
        return;
      }
      if (!res.ok || !json.url) {
        setError(json.error ?? 'Checkout is unavailable right now.');
        setBusy(false);
        return;
      }
      window.location.href = json.url;
    } catch {
      setError('Network error — try again.');
      setBusy(false);
    }
  }

  if (!emailCaptured) {
    return (
      <div className="rounded-2xl border border-[hsl(220,45%,45%)]/30 bg-[hsl(220,45%,45%)]/[0.06] p-5">
        <div className="flex items-center gap-2.5 mb-2">
          <Mail size={16} className="text-[hsl(220,45%,40%)]" aria-hidden="true" />
          <h3 className="font-display text-base tracking-tight">Get your free report by email</h3>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
          We&apos;ll send you this score and your full list of missing items — free.
        </p>
        <form onSubmit={submitEmail} className="flex gap-2" noValidate>
          <label htmlFor="scan-email" className="sr-only">
            Email address
          </label>
          <Input
            id="scan-email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@yourcareservice.co.uk"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 flex-1 bg-white"
          />
          <button
            type="submit"
            disabled={busy || !email.includes('@')}
            className="shrink-0 rounded-lg h-11 px-5 text-sm font-semibold bg-[hsl(220,50%,15%)] text-white hover:bg-[hsl(220,50%,20%)] transition-colors disabled:opacity-50"
          >
            {busy ? 'Sending…' : 'Email my report'}
          </button>
        </form>
        {error ? (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {error}
          </p>
        ) : null}
        <p className="mt-2 text-[11px] text-muted-foreground">
          No spam — one email with your results, that&apos;s it.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[hsl(152,47%,38%)]/30 bg-[hsl(152,47%,38%)]/[0.05] p-5">
      <div className="flex items-center gap-2.5 mb-2">
        <LockOpen size={16} className="text-[hsl(152,45%,30%)]" aria-hidden="true" />
        <h3 className="font-display text-base tracking-tight">Unlock the full fix-by-fix report</h3>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed mb-4">
        Your free summary is on its way. The full report un-blurs every &ldquo;how to fix&rdquo;
        below and includes a downloadable PDF with step-by-step remediation for all{' '}
        <strong>19 checks</strong> — written for UK care providers.
      </p>
      <button
        type="button"
        onClick={buyReport}
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg h-12 text-sm font-semibold bg-[hsl(220,50%,15%)] text-white hover:bg-[hsl(220,50%,20%)] transition-colors disabled:opacity-60"
      >
        <FileDown size={16} aria-hidden="true" />
        {busy ? 'Opening checkout…' : 'Get the full report — £8.99'}
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        One-time payment · Instant unlock · PDF included
      </p>
    </div>
  );
}
