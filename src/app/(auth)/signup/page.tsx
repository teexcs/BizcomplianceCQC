'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { createClient } from '@/lib/supabase/client';
import { BrandMark } from '@/components/site/brand-mark';

const SERVICE_TYPES = [
  { value: 'domiciliary-care', label: 'Domiciliary care' },
  { value: 'supported-living', label: 'Supported living' },
  { value: 'care-home', label: 'Care home (residential)' },
  { value: 'nursing-home', label: 'Care home (nursing)' },
  { value: 'clinic', label: 'Clinic / treatment service' },
  { value: 'new-provider', label: 'New provider (pre-registration)' },
  { value: 'other', label: 'Other regulated service' },
];

export default function SignupPage() {
  const [businessName, setBusinessName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        data: {
          business_name: businessName,
          full_name: fullName,
          service_type: serviceType || 'domiciliary-care',
        },
      },
    });

    if (authError) {
      setError(
        authError.message.includes('already registered')
          ? 'An account with this email already exists — try signing in instead.'
          : authError.message,
      );
      setLoading(false);
      return;
    }
    setDone(true);
    setLoading(false);
  };

  if (done) {
    return (
      <div className="space-y-6 text-center">
        <BrandMark href="/" className="items-center" />
        <h1 className="mt-6 font-display text-2xl tracking-tight">Check your inbox</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          We&apos;ve sent a confirmation link to <strong>{email}</strong>. Click it to activate your
          workspace, then sign in to start your CQC readiness journey.
        </p>
        <p className="text-sm">
          <Link href="/login" className="text-[hsl(220,45%,45%)] hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <BrandMark href="/" className="items-center" />
        <h1 className="mt-6 font-display text-2xl tracking-tight">Create your account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Inspection readiness for CQC-registered care providers
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="businessName">Care service / business name</Label>
          <Input
            id="businessName"
            autoComplete="organization"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fullName">Your name</Label>
          <Input
            id="fullName"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@yourcareservice.co.uk"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
          <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="serviceType">Service type</Label>
          <Select
            id="serviceType"
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
            required
          >
            <option value="">Select your service type</option>
            {SERVICE_TYPES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium h-10 bg-[hsl(220,50%,15%)] text-[hsl(36,33%,97%)] hover:bg-[hsl(220,50%,15%)]/90 transition-colors disabled:opacity-50"
        >
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="text-sm text-muted-foreground text-center">
        Already have an account?{' '}
        <Link href="/login" className="text-[hsl(220,45%,45%)] hover:underline">
          Sign in
        </Link>
      </p>

      <p className="text-xs text-muted-foreground text-center">
        BizCompliance is a compliance system, not legal advice. For advice on your individual
        circumstances, instruct a regulated solicitor.
      </p>
    </div>
  );
}
