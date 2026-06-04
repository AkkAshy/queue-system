'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/store/auth-store';
import { useTr } from '@/lib/i18n';
import type { LoginResponse } from '@queue/types';

export default function LoginPage() {
  const router = useRouter();
  const tr = useTr();
  const loginSuccess = useAuthStore((s) => s.loginSuccess);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        toast.error(tr("Login yoki parol noto'g'ri", "Login yamasa parol natuwrı"));
        return;
      }
      const data = (await res.json()) as LoginResponse;
      loginSuccess(data);
      router.replace('/dashboard');
    } catch {
      toast.error(tr('Tarmoq mavjud emas', 'Tarmaq joq'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-7 rounded-2xl border border-hair bg-white/50 p-10 shadow-paper-lift"
      >
        <div>
          <span className="eyebrow text-coral">NDPI · Admin</span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            {tr('Panelga kirish', 'Panelge kiriw')}
          </h1>
          <p className="mt-2 text-sm text-coal-3">
            Demo: <code className="text-coral-600">admin / admin</code>
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">{tr('Login', 'Login')}</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              autoComplete="username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{tr('Parol', 'Parol')}</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={submitting}
          className="w-full bg-coral text-cream hover:bg-coral-600"
        >
          {submitting ? '…' : tr('Kirish', 'Kiriw')}
        </Button>
      </form>
    </main>
  );
}
