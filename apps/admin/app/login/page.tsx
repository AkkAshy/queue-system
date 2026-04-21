'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/store/auth-store';
import type { LoginResponse } from '@queue/types';

export default function LoginPage() {
  const router = useRouter();
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
        toast.error('Неверные учётные данные');
        return;
      }
      const data = (await res.json()) as LoginResponse;
      loginSuccess(data);
      router.replace('/dashboard');
    } catch {
      toast.error('Сеть недоступна');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-7 rounded-2xl border border-ink-700 bg-ink-800/50 p-10 shadow-paper-lift"
      >
        <div>
          <span className="eyebrow text-brass-500">NDPI · Admin</span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Вход в панель
          </h1>
          <p className="mt-2 text-sm text-ink-400">
            Демо: <code className="text-brass-400">admin / admin</code>
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Логин</Label>
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
            <Label htmlFor="password">Пароль</Label>
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
          className="w-full bg-brass-500 text-ink-900 hover:bg-brass-400"
        >
          {submitting ? '…' : 'Войти'}
        </Button>
      </form>
    </main>
  );
}
