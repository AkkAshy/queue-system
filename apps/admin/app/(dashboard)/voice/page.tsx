'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Upload, Trash2, Play, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTr } from '@/lib/i18n';

type Kind = 'letter' | 'num' | 'window';

interface VoiceClip {
  id: number;
  kind: Kind;
  key: string;
  url: string;
  enabled: boolean;
  updated_at: string;
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
const NUMS = Array.from({ length: 101 }, (_, i) => String(i)); // 0..100
const WINDOWS = Array.from({ length: 23 }, (_, i) => String(i + 1)); // 1..23

async function fetchClips(): Promise<VoiceClip[]> {
  const res = await fetch('/api/display/voice-clips');
  return res.json();
}

export default function VoicePage() {
  const tr = useTr();
  const qc = useQueryClient();
  const { data: clips = [] } = useQuery({ queryKey: ['voice-clips'], queryFn: fetchClips });

  const bySlot = new Map(clips.map((c) => [`${c.kind}_${c.key}`, c]));
  const [sel, setSel] = useState<{ kind: Kind; key: string } | null>(null);
  const [extra, setExtra] = useState<Record<Kind, string[]>>({ letter: [], num: [], window: [] });
  const [newKey, setNewKey] = useState<Record<Kind, string>>({ letter: '', num: '', window: '' });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['voice-clips'] });

  const upload = useMutation({
    mutationFn: async ({ kind, key, file }: { kind: Kind; key: string; file: File }) => {
      const fd = new FormData();
      fd.append('kind', kind);
      fd.append('key', key);
      fd.append('file', file);
      const res = await fetch('/api/display/voice-clips', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('failed');
      return res.json();
    },
    onSuccess: () => { invalidate(); toast.success(tr('Yuklandi', 'Júklendi')); },
    onError: () => toast.error(tr("Yuklab bo'lmadi", 'Júklep bolmadı')),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/display/voice-clips/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('failed');
    },
    onSuccess: () => { invalidate(); toast.success(tr("O'chirildi", 'Óshirildi')); },
    onError: () => toast.error(tr("O'chirishda xato", 'Óshiriwde qáte')),
  });

  // Переключатель lola ⇄ своя запись — НЕ удаляет файл, только enabled.
  const toggle = useMutation({
    mutationFn: async ({ id, enabled }: { id: number; enabled: boolean }) => {
      const res = await fetch(`/api/display/voice-clips/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error('failed');
      return res.json();
    },
    onSuccess: () => invalidate(),
  });

  const play = (url: string, v: string) => {
    new Audio(`${url}?v=${Date.parse(v) || 0}`).play().catch(() => {});
  };

  // Ключи слота = дефолтные + уже загруженные на сервере (включая добавленные
  // сверх дефолта — иначе после перезагрузки они «теряются» из UI) + только что
  // добавленные локально. Set убирает дубли (и чинит коллизию React-ключей при
  // добавлении значения из дефолтного диапазона).
  const serverKeys = (kind: Kind) => clips.filter((c) => c.kind === kind).map((c) => c.key);
  const sections: { kind: Kind; title: string; keys: string[] }[] = [
    { kind: 'letter', title: tr('Harflar', 'Háripler'), keys: [...new Set([...LETTERS, ...serverKeys('letter'), ...extra.letter])] },
    { kind: 'num', title: tr('Raqamlar', 'Sanlar'), keys: [...new Set([...NUMS, ...serverKeys('num'), ...extra.num])] },
    { kind: 'window', title: tr('Oynalar', 'Áyneler'), keys: [...new Set([...WINDOWS, ...serverKeys('window'), ...extra.window])] },
  ];

  const selClip = sel ? bySlot.get(`${sel.kind}_${sel.key}`) : undefined;

  return (
    <div className="max-w-4xl space-y-6 pb-28">
      <div>
        <span className="eyebrow text-coral">{tr('Tablo', 'Tablo')}</span>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{tr('Ovoz (chaqiruv)', 'Dawıs (shaqırıw)')}</h1>
        <p className="mt-1 text-sm text-coal-3">
          {tr(
            "Har bir bo'lakka mp3 yuklang — yuklanmaganda lola ovozi ishlaydi",
            'Hár bir bólekke mp3 júkleń — júklenbegende lola dawısı islaydi',
          )}
        </p>
      </div>

      {sections.map((sec) => (
        <div key={sec.kind} className="space-y-3 rounded-xl border border-hair bg-card p-6">
          <h2 className="text-lg font-semibold">{sec.title}</h2>
          <div className="flex flex-wrap gap-2">
            {sec.keys.map((key) => {
              const clip = bySlot.get(`${sec.kind}_${key}`);
              const usingCustom = !!clip && clip.enabled;   // играет своя запись
              const hasDisabled = !!clip && !clip.enabled;  // запись есть, но lola
              const active = sel?.kind === sec.kind && sel.key === key;
              return (
                <button
                  key={key}
                  onClick={() => setSel({ kind: sec.kind, key })}
                  title={
                    usingCustom
                      ? tr('Yuklangan', 'Júklengen')
                      : hasDisabled
                        ? tr('Yuklangan · lola yoqilgan', 'Júklengen · lola qosılǵan')
                        : 'lola'
                  }
                  className={
                    'flex h-10 min-w-[2.5rem] items-center justify-center rounded-lg border px-2 text-sm font-medium transition-colors ' +
                    (active ? 'ring-2 ring-coral/40 ' : '') +
                    (usingCustom
                      ? 'border-coral bg-coral/10 text-coral-600'
                      : hasDisabled
                        ? 'border-coral/50 text-coal-2'
                        : 'border-hair-2 bg-card text-coal-2')
                  }
                >
                  {key}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Input
              value={newKey[sec.kind]}
              onChange={(e) => setNewKey((s) => ({ ...s, [sec.kind]: e.target.value }))}
              placeholder={tr('Yangi belgi', 'Jańa belgi')}
              className="h-9 w-40"
            />
            <Button
              onClick={() => {
                const k = newKey[sec.kind].trim();
                if (!k) return;
                setExtra((s) => ({ ...s, [sec.kind]: [...new Set([...s[sec.kind], k])] }));
                setNewKey((s) => ({ ...s, [sec.kind]: '' }));
                setSel({ kind: sec.kind, key: k });
              }}
              className="h-9 gap-1 border border-hair-2 bg-card text-coal hover:bg-hair/30"
            >
              <Plus className="h-4 w-4" /> {tr("Qo'shish", 'Qosıw')}
            </Button>
          </div>
        </div>
      ))}

      {sel && (
        <div className="fixed bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-coral/40 bg-card p-4 shadow-soft">
          <span className="text-sm font-medium">
            {tr("Bo'lak", 'Bólek')}: <b>{sel.kind}_{sel.key}</b>
          </span>
          {selClip && (
            <div className="flex items-center gap-2 rounded-lg border border-hair-2 px-2 py-1 text-sm">
              <button
                onClick={() => toggle.mutate({ id: selClip.id, enabled: false })}
                className={!selClip.enabled ? 'font-semibold text-coral' : 'text-coal-3'}
              >
                lola
              </button>
              <span className="text-coal-3">·</span>
              <button
                onClick={() => toggle.mutate({ id: selClip.id, enabled: true })}
                className={selClip.enabled ? 'font-semibold text-coral' : 'text-coal-3'}
              >
                {tr('Oʻz yozuvi', 'Óz jazıwı')}
              </button>
            </div>
          )}
          {selClip && (
            <Button
              onClick={() => play(selClip.url, selClip.updated_at)}
              className="gap-1 border border-hair-2 bg-card text-coal hover:bg-hair/30"
            >
              <Play className="h-4 w-4" /> {tr('Tinglash', 'Tıńlaw')}
            </Button>
          )}
          <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-coral px-3 py-2 text-sm text-cream hover:bg-coral-600">
            <Upload className="h-4 w-4" /> {selClip ? tr('Almashtirish', 'Almastırıw') : tr('Yuklash', 'Júklew')}
            <input
              type="file"
              accept="audio/mpeg,.mp3"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && sel) upload.mutate({ kind: sel.kind, key: sel.key, file });
                e.target.value = '';
              }}
            />
          </label>
          {selClip && (
            <Button
              onClick={() => { remove.mutate(selClip.id); setSel(null); }}
              className="gap-1 border border-hair-2 bg-card text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" /> {tr("O'chirish", 'Óshiriw')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
