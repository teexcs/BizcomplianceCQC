'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Clock3, Eye, EyeOff, Lock, MailCheck, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { createClient } from '@/lib/supabase/client';

const SERVICE_TYPES = [
  { value: 'domiciliary-care', label: 'Domiciliary care' },
  { value: 'supported-living', label: 'Supported living' },
  { value: 'care-home', label: 'Care home (residential)' },
  { value: 'nursing-home', label: 'Care home (nursing)' },
  { value: 'clinic', label: 'Clinic / treatment service' },
  { value: 'new-provider', label: 'New provider (pre-registration)' },
  { value: 'other', label: 'Other regulated service' },
];

const PRIORITIES = [
  { value: 'evidence-gaps', label: 'Evidence gaps' },
  { value: 'medicines', label: 'Medicines management' },
  { value: 'staffing', label: 'Staffing and rotas' },
  { value: 'governance', label: 'Governance and oversight' },
  { value: 'pre-registration', label: 'Pre-registration prep' },
];

const QUESTIONS = [
  'What type of regulated service are you running?',
  'Which CQC area feels weakest right now?',
  'Are you preparing for a first inspection or a re-inspection?',
  'What evidence or records are missing?',
];

export function HeroSignup() {
  const [businessName, setBusinessName] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [priority, setPriority] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Password needs at least 8 characters.');
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        data: {
          business_name: businessName,
          service_type: serviceType || 'domiciliary-care',
          priority: priority || 'evidence-gaps',
        },
      },
    });
    if (authError) {
      setError(
        authError.message.includes('already registered')
          ? 'An account with this email already exists — sign in instead.'
          : authError.message,
      );
      setLoading(false);
      return;
    }
    setDone(true);
    setLoading(false);
  };

  return (
    <div className="relative">
      {/* Blue halo behind the card */}
      <div
        aria-hidden="true"
        className="absolute -inset-6 rounded-[2rem] bg-[radial-gradient(closest-side,rgba(77,120,214,0.22),transparent)] blur-2xl"
      />
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,hsl(220,50%,16%),hsl(220,45%,11%))] text-[hsl(36,33%,97%)] shadow-[0_24px_80px_-24px_rgba(12,20,35,0.55)]">
        {/* Blue hairline */}
        <div
          aria-hidden="true"
          className="h-1 w-full bg-gradient-to-r from-[#6f98ff] via-[#d0dffe] to-[#6f98ff]"
        />
        <div className="space-y-6 p-6 md:p-8">
          {done ? (
            <div className="py-10 text-center space-y-4">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/10">
                <MailCheck className="text-white" size={26} aria-hidden="true" />
              </div>
              <h3 className="font-display text-2xl tracking-tight text-white">
                Check your inbox
              </h3>
              <p className="mx-auto max-w-xs text-sm leading-relaxed text-white/72">
                We&apos;ve emailed a confirmation link to <strong>{email}</strong>. Click it, sign
                in, and your workspace is ready.
              </p>
              <Link href="/login" className="inline-block text-sm text-white underline-offset-4 hover:underline">
                Go to sign in
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/55">
                    Original BizCompliance
                  </p>
                  <h2 className="mt-2 font-display text-xl md:text-2xl tracking-tight text-white">
                    A better starting point
                  </h2>
                  <p className="mt-2 max-w-md text-sm text-white/70">
                    Give us the key details first, then use the same login flow to get into your
                    workspace.
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80">
                  <Clock3 size={13} aria-hidden="true" /> 5 min
                </span>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">We ask</p>
                <div className="mt-3 space-y-3">
                  {QUESTIONS.map((question) => (
                    <div key={question} className="flex items-start gap-3">
                      <span className="mt-1 h-2 w-2 rounded-full bg-[#8fb1ff]" aria-hidden="true" />
                      <p className="text-sm leading-relaxed text-white/80">{question}</p>
                    </div>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="hero-business" className="text-white/80">
                    Care service name
                  </Label>
                  <Input
                    id="hero-business"
                    autoComplete="organization"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    required
                    placeholder="e.g. Oakfield Community Care"
                    className="h-11 border-white/10 bg-white/5 text-white placeholder:text-white/40 focus-visible:ring-[#8fb1ff]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="hero-service" className="text-white/80">
                    Service type
                  </Label>
                  <Select
                    id="hero-service"
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value)}
                    required
                    className="h-11 border-white/10 bg-white/5 text-white focus-visible:ring-[#8fb1ff]"
                  >
                    <option value="" className="text-[hsl(220,33%,8%)]">
                      Select your service type
                    </option>
                    {SERVICE_TYPES.map((s) => (
                      <option key={s.value} value={s.value} className="text-[hsl(220,33%,8%)]">
                        {s.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="hero-priority" className="text-white/80">
                    What needs attention most?
                  </Label>
                  <Select
                    id="hero-priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    required
                    className="h-11 border-white/10 bg-white/5 text-white focus-visible:ring-[#8fb1ff]"
                  >
                    <option value="" className="text-[hsl(220,33%,8%)]">
                      Pick the main issue
                    </option>
                    {PRIORITIES.map((item) => (
                      <option key={item.value} value={item.value} className="text-[hsl(220,33%,8%)]">
                        {item.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="hero-email" className="text-white/80">
                    Work email
                  </Label>
                  <Input
                    id="hero-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@yourcareservice.co.uk"
                    className="h-11 border-white/10 bg-white/5 text-white placeholder:text-white/40 focus-visible:ring-[#8fb1ff]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="hero-password" className="text-white/80">
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="hero-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      placeholder="8+ characters"
                      className="h-11 pr-11 border-white/10 bg-white/5 text-white placeholder:text-white/40 focus-visible:ring-[#8fb1ff]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-2.5 text-white/55 hover:text-white"
                    >
                      {showPassword ? (
                        <EyeOff size={16} aria-hidden="true" />
                      ) : (
                        <Eye size={16} aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>

                {error ? (
                  <p role="alert" className="text-sm text-[hsl(8,80%,72%)]">
                    {error}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg h-12 text-sm font-semibold bg-white text-[hsl(220,50%,15%)] hover:bg-[hsl(220,33%,95%)] active:scale-[0.99] transition-all disabled:opacity-60"
                >
                  {loading ? 'Creating your workspace…' : 'Create free account'}
                </button>

                <div className="flex flex-wrap items-center justify-center gap-4 pt-1 text-[11px] text-white/60">
                  <span className="inline-flex items-center gap-1">
                    <Lock size={11} aria-hidden="true" /> Encrypted
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <ShieldCheck size={11} aria-hidden="true" /> UK GDPR
                  </span>
                  <span>No card required</span>
                </div>

                <p className="text-center text-xs text-white/62">
                  Already registered?{' '}
                  <Link href="/login" className="font-medium text-white underline-offset-4 hover:underline">
                    Sign in
                  </Link>
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
