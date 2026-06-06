'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import type { DisplaySettings } from '@queue/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTr } from '@/lib/i18n';

async function fetchSettings(): Promise<DisplaySettings> {
  const res = await fetch('/api/display/settings');
  return res.json();
}

function youtubeId(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    let id = '';
    if (u.hostname.includes('youtu.be')) id = u.pathname.slice(1);
    else if (u.searchParams.get('v')) id = u.searchParams.get('v') as string;
    else if (u.pathname.includes('/embed/')) id = u.pathname.split('/embed/')[1] ?? '';
    id = (id.split('/')[0] ?? '').trim();
    return id || null;
  } catch {
    return null;
  }
}

type Form = {
  org_name: string;
  youtube_url: string;
  ticker_text: string;
  voice_enabled: boolean;
  voice_lang: string;
};

const EMPTY: Form = {
  org_name: '',
  youtube_url: '',
  ticker_text: '',
  voice_enabled: true,
  voice_lang: 'ru-RU',
};

export default function DisplaySettingsPage() {
  const tr = useTr();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['display-settings'], queryFn: fetchSettings });
  const [form, setForm] = useState<Form>(EMPTY);
  const [loaded, setLoaded] = useState<Form>(EMPTY);

  useEffect(() => {
    if (data) {
      const f: Form = {
        org_name: data.org_name ?? '',
        youtube_url: data.youtube_url ?? '',
        ticker_text: data.ticker_text ?? '',
        voice_enabled: data.voice_enabled ?? true,
        voice_lang: data.voice_lang ?? 'ru-RU',
      };
      setForm(f);
      setLoaded(f);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async (body: Form) => {
      const res = await fetch('/api/display/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('failed');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['display-settings'] });
      toast.success(tr('Saqlandi — tablo avtomatik yangilanadi', 'Saqlandı — tablo avtomat túrde jańalanadı'));
    },
    onError: () => toast.error(tr("Saqlab bo'lmadi", 'Saqlap bolmadı')),
  });

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const dirty = JSON.stringify(form) !== JSON.stringify(loaded);
  const id = youtubeId(form.youtube_url);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <span className="eyebrow text-coral">{tr('Tablo', 'Tablo')}</span>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{tr('Tizim sozlamalari', 'Sistema sazlawları')}</h1>
        <p className="mt-1 text-sm text-coal-3">{tr('Nomi, video, ovoz, yuguruvchi satr', 'Atı, video, dawıs, juwırıwshı qatar')}</p>
      </div>

      <div className="space-y-5 rounded-xl border border-hair bg-card p-6">
        <div className="space-y-2">
          <Label htmlFor="org">{tr('Muassasa nomi', 'Mákeme atı')}</Label>
          <Input
            id="org"
            value={form.org_name}
            onChange={(e) => set('org_name', e.target.value)}
            placeholder="Ájiniyaz atındaǵı NMPI"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="yt">{tr('Tablodagi video (YouTube)', 'Tablodaǵı video (YouTube)')}</Label>
          <Input
            id="yt"
            value={form.youtube_url}
            onChange={(e) => set('youtube_url', e.target.value)}
            placeholder={tr("https://youtu.be/… (bo'sh — logotip)", 'https://youtu.be/… (bos — logotip)')}
          />
          {id && (
            <div className="mt-2 overflow-hidden rounded-lg border border-hair">
              <div className="aspect-video">
                <iframe
                  key={id}
                  className="h-full w-full"
                  src={`https://www.youtube-nocookie.com/embed/${id}?mute=1&modestbranding=1&rel=0`}
                  allow="encrypted-media"
                  title={tr("Oldindan ko'rish", 'Aldın ala kóriw')}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between rounded-lg border border-hair-2 px-4 py-3">
          <div>
            <Label htmlFor="voice">{tr("Ovozli e'lon", 'Dawıslı járiyalaw')}</Label>
            <p className="text-xs text-coal-3">{tr('Tablodagi chaqiruvlarni ovoz bilan', 'Tablodaǵı shaqırıwlardı dawıs penen')}</p>
          </div>
          <input
            id="voice"
            type="checkbox"
            checked={form.voice_enabled}
            onChange={(e) => set('voice_enabled', e.target.checked)}
            className="h-5 w-5 accent-coral"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="lang">{tr('Ovoz tili', 'Dawıs tili')}</Label>
          <Input
            id="lang"
            value={form.voice_lang}
            onChange={(e) => set('voice_lang', e.target.value)}
            placeholder="ru-RU"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ticker">{tr('Yuguruvchi satr (har bir xabar alohida qatorda)', 'Juwırıwshı qatar (hár bir xabar ayrıqsha qatarda)')}</Label>
          <textarea
            id="ticker"
            rows={3}
            value={form.ticker_text}
            onChange={(e) => set('ticker_text', e.target.value)}
            placeholder={tr('Chaqiruvgacha talonni saqlang\nTablodan chaqiruvni kuting', 'Shaqırıwǵa deyin talondı saqlań\nTablodan shaqırıwdı kútiń')}
            className="w-full rounded-lg border border-hair-2 bg-card px-3 py-2 text-sm text-coal outline-none focus:border-coral"
          />
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => save.mutate(form)}
            disabled={!dirty || save.isPending}
            className="gap-2 bg-coral text-cream hover:bg-coral-600"
          >
            <Save className="h-4 w-4" />
            {save.isPending ? tr('Saqlanmoqda…', 'Saqlanbaqta…') : tr('Saqlash', 'Saqlaw')}
          </Button>
          {dirty && <span className="text-xs text-coal-3">{tr("Saqlanmagan o'zgarishlar bor", 'Saqlanbaǵan ózgerisler bar')}</span>}
        </div>
      </div>
    </div>
  );
}
