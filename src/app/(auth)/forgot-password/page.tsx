'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';
import { BrandMark } from '@/components/site/brand-mark';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    // Always show the same confirmation regardless of outcome — never reveal
    // whether an email is registered.
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setSubmitted(true);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <BrandMark href="/" className="items-center" />
        <h1 className="mt-6 font-display text-2xl tracking-tight">Reset your password</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter your email and we&apos;ll send you a reset link
        </p>
      </div>

      {submitted ? (
        <div className="text-center space-y-4">
          <div className="p-4 border rounded-lg bg-muted/30">
            <p className="text-sm">
              If an account exists with that email, you will receive a password reset link shortly.
            </p>
          </div>
          <Link href="/login" className="text-sm text-[hsl(220,45%,45%)] hover:underline">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium h-10 bg-[hsl(220,50%,15%)] text-[hsl(36,33%,97%)] hover:bg-[hsl(220,50%,15%)]/90 transition-colors disabled:opacity-50"
          >
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}

      <p className="text-sm text-muted-foreground text-center">
        Remembered it?{' '}
        <Link href="/login" className="text-[hsl(220,45%,45%)] hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
