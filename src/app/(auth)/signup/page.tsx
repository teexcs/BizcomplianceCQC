'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';
import { BrandMark } from '@/components/site/brand-mark';
import { CompanyNameField } from '@/components/site/company-name-field';
import { BoxedDropdown } from '@/components/site/boxed-dropdown';
import { sendWelcomeEmail } from '@/lib/actions/auth';

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
  const router = useRouter();
  const [businessName, setBusinessName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [otherServiceType, setOtherServiceType] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const fieldClass = 'rounded-none border-slate-300 bg-white focus-visible:ring-slate-300';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      setLoading(false);
      return;
    }
    if (serviceType === 'other' && !otherServiceType.trim()) {
      setError('Please describe your service type.');
      setLoading(false);
      return;
    }

    const resolvedServiceType = serviceType === 'other' ? otherServiceType.trim() : serviceType;

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/pricing?buy=audit`,
        data: {
          business_name: businessName,
          full_name: fullName,
          service_type: resolvedServiceType || 'domiciliary-care',
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
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      router.push('/pricing?buy=audit');
      router.refresh();
      return;
    }
    await sendWelcomeEmail({
      businessName: businessName || 'BizCompliance client',
      email,
      serviceType: resolvedServiceType || 'domiciliary-care',
    });
    setDone(true);
    setLoading(false);
  };

  if (done) {
    return (
      <div className="space-y-6 text-center">
        <BrandMark href="/" className="items-center" />
        <h1 className="mt-6 font-display text-2xl tracking-tight">Check your inbox</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          We&apos;ve sent a confirmation link to <strong>{email}</strong>. Confirm your email,
          then you&apos;ll return to pricing to book the audit that unlocks the dashboard.
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
          <CompanyNameField
            id="businessName"
            autoComplete="organization"
            value={businessName}
            onValueChange={setBusinessName}
            required
            className={fieldClass}
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
            className={fieldClass}
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
            className={fieldClass}
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
            className={fieldClass}
          />
          <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="serviceType">Service type</Label>
          <BoxedDropdown
            id="serviceType"
            value={serviceType}
            onChange={(value) => {
              setServiceType(value);
              if (value !== 'other') setOtherServiceType('');
            }}
            options={SERVICE_TYPES}
            placeholder="Select your service type"
            className={fieldClass}
          />
          {serviceType === 'other' ? (
            <div className="space-y-2">
              <Label htmlFor="otherServiceType">Tell us your service</Label>
              <Input
                id="otherServiceType"
                value={otherServiceType}
                onChange={(e) => setOtherServiceType(e.target.value)}
                required
                placeholder="Type your service here"
                className={fieldClass}
              />
            </div>
          ) : null}
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
          {loading ? 'Booking your CQC audit…' : 'Book your CQC audit'}
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
