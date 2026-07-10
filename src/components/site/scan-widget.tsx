'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Building2, Link2, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * The free website compliance scanner card — small, like a payment widget.
 * Posts to /api/scan (a real crawl of up to 12 pages) and sends the visitor
 * to their results page.
 */
export function ScanWidget() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url, companyName }),
      });
      const json = (await res.json()) as { ok?: boolean; id?: string; error?: string };
      if (!res.ok || !json.id) {
        setError(json.error ?? 'The scan failed — please try again.');
        setBusy(false);
        return;
      }
      router.push(`/scan/${json.id}`);
    } catch {
      setError('Network error — please try again.');
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card shadow-[0_18px_60px_-24px_rgba(21,32,58,0.25)] p-6 md:p-7 w-full max-w-md">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground mb-2">
        Start here
      </p>
      <h3 className="font-display text-xl tracking-tight text-foreground">
        Run a real website audit
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Enter your website and optional company details.
      </p>

      <form onSubmit={run} className="mt-5 space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="scan-url">Website URL</Label>
          <div className="relative">
            <Link2
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="scan-url"
              type="url"
              inputMode="url"
              required
              placeholder="https://www.example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="h-11 pl-10"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="scan-company">Company name (optional)</Label>
          <div className="relative">
            <Building2
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="scan-company"
              placeholder="Example Care Ltd"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="h-11 pl-10"
            />
          </div>
        </div>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy || url.length < 4}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl h-12 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.99] transition-all disabled:opacity-60"
        >
          {busy ? (
            <>
              <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Scanning your site…
            </>
          ) : (
            <>
              Run audit — free <ArrowRight size={15} aria-hidden="true" />
            </>
          )}
        </button>
      </form>

      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        Free score &amp; missing items · Real page-by-page scan · Full report £8.99
      </p>
    </div>
  );
}
