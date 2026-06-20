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
// Static import → URL carries basePath (/admin) in prod, plain in dev.
import logo from '@/public/nmpi-logo.png';

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
      // Нормализация: убираем пробелы по краям (автозаполнение/мобильная
      // клавиатура часто подставляют лишний пробел — из-за него вход не проходит).
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim(),
        }),
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
        className="w-full max-w-md space-y-7 rounded-2xl border border-hair bg-card/50 p-10 shadow-soft"
      >
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logo.src}
            alt="NMPI"
            className="mb-5 h-16 w-16 rounded-full bg-white object-contain p-1 ring-1 ring-hair"
          />
          <span className="eyebrow text-coral">NMPI · Admin</span>
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
              // логин не содержит пробелов — вырезаем их сразу при вводе
              onChange={(e) => setUsername(e.target.value.replace(/\s+/g, ''))}
              required
              autoFocus
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
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
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
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
