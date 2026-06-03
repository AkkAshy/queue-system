'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Save, Youtube } from 'lucide-react';
import type { DisplaySettings } from '@queue/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

async function fetchSettings(): Promise<DisplaySettings> {
  const res = await fetch('/api/display/settings');
  return res.json();
}

/** Resolve a YouTube URL to its video id for the live preview. */
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

export default function DisplaySettingsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['display-settings'], queryFn: fetchSettings });
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (data) setUrl(data.youtube_url ?? '');
  }, [data]);

  const save = useMutation({
    mutationFn: async (youtube_url: string) => {
      const res = await fetch('/api/display/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ youtube_url }),
      });
      if (!res.ok) throw new Error('failed');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['display-settings'] });
      toast.success('Сохранено — табло обновится автоматически');
    },
    onError: () => toast.error('Не удалось сохранить'),
  });

  const id = youtubeId(url);
  const dirty = (data?.youtube_url ?? '') !== url;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <span className="eyebrow text-coral">Табло</span>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Настройки табло</h1>
        <p className="mt-1 text-sm text-coal-3">
          Видео в левой части табло (зала ожидания)
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-hair bg-white p-6">
        <div className="space-y-2">
          <Label htmlFor="yt" className="flex items-center gap-2">
            <Youtube className="h-4 w-4 text-coral" />
            Ссылка на YouTube
          </Label>
          <Input
            id="yt"
            placeholder="https://youtu.be/… или https://www.youtube.com/watch?v=…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <p className="text-xs text-coal-3">
            Поддерживаются ссылки youtu.be, watch?v= и /embed/. Пусто — на табло
            покажется логотип института.
          </p>
        </div>

        {id && (
          <div className="overflow-hidden rounded-lg border border-hair">
            <div className="aspect-video">
              <iframe
                key={id}
                className="h-full w-full"
                src={`https://www.youtube-nocookie.com/embed/${id}?mute=1&modestbranding=1&rel=0`}
                allow="encrypted-media"
                title="Предпросмотр"
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button
            onClick={() => save.mutate(url)}
            disabled={!dirty || save.isPending}
            className="gap-2 bg-coral text-cream hover:bg-coral-600"
          >
            <Save className="h-4 w-4" />
            {save.isPending ? 'Сохранение…' : 'Сохранить'}
          </Button>
          {dirty && <span className="text-xs text-coal-3">Есть несохранённые изменения</span>}
        </div>
      </div>
    </div>
  );
}
