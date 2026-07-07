'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(
        authError.message === 'Invalid login credentials'
          ? 'Incorrect email or password.'
          : authError.message,
      );
      setLoading(false);
      return;
    }
    const next = searchParams.get('next');
    router.push(next && next.startsWith('/') ? next : '/dashboard');
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <Link href="/" className="font-display text-2xl font-semibold tracking-tight">
          BizCompliance
        </Link>
        <h1 className="mt-6 font-display text-2xl tracking-tight">Welcome back</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in to your account</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
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
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="text-center space-y-2">
        <p className="text-sm">
          <Link href="/forgot-password" className="text-[hsl(36,45%,45%)] hover:underline">
            Forgot password?
          </Link>
        </p>
        <p className="text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-[hsl(36,45%,45%)] hover:underline">
            Sign up
          </Link>
        </p>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        BizCompliance is a compliance system, not legal advice. For advice on your individual
        circumstances, instruct a regulated solicitor.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
