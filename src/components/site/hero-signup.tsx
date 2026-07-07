'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, Lock, MailCheck, ShieldCheck, Clock3 } from 'lucide-react';
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

export function HeroSignup() {
  const [businessName, setBusinessName] = useState('');
  const [serviceType, setServiceType] = useState('');
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
      {/* Gold halo behind the card */}
      <div
        aria-hidden="true"
        className="absolute -inset-6 rounded-[2rem] bg-[radial-gradient(closest-side,rgba(168,133,63,0.22),transparent)] blur-2xl"
      />
      <div className="relative rounded-2xl border border-[hsl(220,15%,88%)] bg-white shadow-[0_24px_80px_-24px_rgba(21,32,58,0.35)] overflow-hidden">
        {/* Gold hairline */}
        <div
          aria-hidden="true"
          className="h-1 w-full bg-gradient-to-r from-[hsl(36,45%,45%)] via-[hsl(41,55%,62%)] to-[hsl(36,45%,45%)]"
        />
        <div className="p-6 md:p-8">
          {done ? (
            <div className="py-10 text-center space-y-4">
              <div className="mx-auto w-14 h-14 rounded-full bg-[hsl(152,47%,42%)]/10 grid place-items-center">
                <MailCheck className="text-[hsl(152,40%,32%)]" size={26} aria-hidden="true" />
              </div>
              <h3 className="font-display text-2xl tracking-tight text-[hsl(220,33%,8%)]">
                Check your inbox
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                We&apos;ve emailed a confirmation link to <strong>{email}</strong>. Click it, sign
                in, and your workspace is ready.
              </p>
              <Link href="/login" className="inline-block text-sm text-[hsl(36,45%,38%)] hover:underline">
                Go to sign in
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <h2 className="font-display text-xl md:text-2xl tracking-tight text-[hsl(220,33%,8%)]">
                    Create your workspace
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Free to set up — under 5 minutes, no card required.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(36,30%,94%)] px-3 py-1.5 text-xs font-medium text-[hsl(36,45%,32%)] shrink-0">
                  <Clock3 size={13} aria-hidden="true" /> 5 min
                </span>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="hero-business">Care service name</Label>
                  <Input
                    id="hero-business"
                    autoComplete="organization"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    required
                    placeholder="e.g. Oakfield Community Care"
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="hero-service">Service type</Label>
                  <Select
                    id="hero-service"
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value)}
                    required
                    className="h-11"
                  >
                    <option value="">Select your service type</option>
                    {SERVICE_TYPES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="hero-email">Work email</Label>
                  <Input
                    id="hero-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@yourcareservice.co.uk"
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="hero-password">Password</Label>
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
                      className="h-11 pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-1 top-1/2 -translate-y-1/2 p-2.5 text-muted-foreground hover:text-foreground rounded-md"
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
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg h-12 text-sm font-semibold bg-[hsl(220,50%,15%)] text-[hsl(36,33%,97%)] hover:bg-[hsl(220,50%,20%)] active:scale-[0.99] transition-all disabled:opacity-60"
                >
                  {loading ? 'Creating your workspace…' : 'Create free account'}
                </button>

                <div className="flex items-center justify-center gap-4 pt-1 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Lock size={11} aria-hidden="true" /> Encrypted
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <ShieldCheck size={11} aria-hidden="true" /> UK GDPR
                  </span>
                  <span>No card required</span>
                </div>

                <p className="text-center text-xs text-muted-foreground">
                  Already registered?{' '}
                  <Link href="/login" className="text-[hsl(36,45%,38%)] hover:underline font-medium">
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
