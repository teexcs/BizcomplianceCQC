'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';
import { sendWelcomeEmail } from '@/lib/actions/auth';
import { CompanyNameField } from '@/components/site/company-name-field';
import { CountryDropdown, COUNTRIES } from '@/components/site/country-dropdown';
import { BoxedDropdown } from '@/components/site/boxed-dropdown';

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
  const [country, setCountry] = useState(COUNTRIES[0].code);
  const [serviceType, setServiceType] = useState('');
  const [otherServiceType, setOtherServiceType] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const selectedCountry = COUNTRIES.find((item) => item.code === country) ?? COUNTRIES[0];
  const isUk = selectedCountry.code === 'GB';

  const fieldClass =
    'h-11 rounded-none border border-border bg-background px-3 text-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:border-primary';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!businessName.trim()) {
      setError('Please enter your care service name.');
      return;
    }
    if (!country) {
      setError('Please choose a country.');
      return;
    }
    if (!isUk) {
      setError('Please select the United Kingdom to sign up.');
      return;
    }
    if (!serviceType) {
      setError('Please choose a service type.');
      return;
    }
    if (serviceType === 'other' && !otherServiceType.trim()) {
      setError('Please describe your service type.');
      return;
    }
    if (!email.trim()) {
      setError('Please enter a work email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password needs at least 8 characters.');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const resolvedServiceType = serviceType === 'other' ? otherServiceType.trim() : serviceType;
    const { error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        data: {
          business_name: businessName.trim(),
          country: selectedCountry.label,
          service_type: resolvedServiceType || 'domiciliary-care',
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

    await sendWelcomeEmail({
      businessName: businessName.trim(),
      email: email.trim(),
      serviceType: resolvedServiceType,
    });

    setDone(true);
    setLoading(false);
  };

  if (done) {
    return (
      <div className="space-y-4 pt-6">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Welcome email sent
        </p>
        <h2 className="font-display text-2xl tracking-tight text-foreground">
          Check your inbox
        </h2>
        <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
          We’ve emailed instructions for your dashboard. Open it, upload your policies and records,
          and watch each evidence upload fill the progress bars.
        </p>
        <p className="text-sm">
          <Link href="/login" className="text-primary hover:underline">
            Go to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 pt-4">
      <div className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
          Sign up
        </p>
        <h2 className="font-display text-2xl md:text-3xl tracking-tight text-foreground">
          Create your account
        </h2>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          Your secure audit workspace opens after sign-up, where you can upload evidence, receive
          your report and track progress.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-xl" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="hero-business">Care service name</Label>
          <CompanyNameField
            id="hero-business"
            autoComplete="organization"
            value={businessName}
            onValueChange={setBusinessName}
            required
            placeholder="e.g. Oakfield Community Care"
            className={fieldClass}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="hero-country">Country</Label>
          <CountryDropdown
            id="hero-country"
            value={country}
            onChange={setCountry}
            className={fieldClass}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="hero-service">Service type</Label>
          <BoxedDropdown
            id="hero-service"
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
            <div className="space-y-1.5 pt-1.5">
              <Label htmlFor="hero-other-service">Tell us your service</Label>
              <Input
                id="hero-other-service"
                value={otherServiceType}
                onChange={(e) => setOtherServiceType(e.target.value)}
                required
                placeholder="Type your service here"
                className={fieldClass}
              />
            </div>
          ) : null}
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
            className={fieldClass}
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
              className={`${fieldClass} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-0 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
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
          className="w-full inline-flex items-center justify-center rounded-none border border-primary bg-primary px-4 h-11 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {loading ? 'Booking your CQC audit…' : 'Book your CQC audit'}
        </button>

        <div className="flex flex-wrap items-center gap-4 pt-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Lock size={11} aria-hidden="true" /> Encrypted
          </span>
          <span className="inline-flex items-center gap-1">
            <ShieldCheck size={11} aria-hidden="true" /> UK GDPR
          </span>
          <span>Dashboard onboarding</span>
        </div>

        <p className="text-sm text-muted-foreground">
          Already registered?{' '}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
