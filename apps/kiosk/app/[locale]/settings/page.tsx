'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Check, Printer, RefreshCw } from 'lucide-react';
import { KioskHeader } from '@/components/KioskHeader';
import {
  listPrinters,
  getSelectedPrinter,
  setSelectedPrinter,
  printTest,
} from '@/lib/printer';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; printers: string[]; agentDefault: string };

export default function SettingsPage() {
  const t = useTranslations('settings');
  const locale = useLocale();
  const router = useRouter();

  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [selected, setSelected] = useState('');
  const [saved, setSaved] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  async function load() {
    setState({ status: 'loading' });
    try {
      const { printers, default: agentDefault } = await listPrinters();
      setState({ status: 'ready', printers, agentDefault });
      // Pre-select the saved choice, else the agent default.
      setSelected(getSelectedPrinter() || agentDefault || printers[0] || '');
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = () => {
    setSelectedPrinter(selected);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const test = async () => {
    setTestMsg(t('testing'));
    const res = await printTest(selected);
    setTestMsg(res.ok ? t('testOk') : `${t('testFail')}: ${res.error ?? ''}`);
    setTimeout(() => setTestMsg(null), 4000);
  };

  return (
    <main className="flex min-h-screen flex-col bg-cream">
      <KioskHeader />

      <section className="flex flex-1 justify-center px-10 pb-16 pt-10">
        <div className="w-full max-w-2xl">
          <div className="mb-8 text-center">
            <span className="eyebrow text-coral">{t('eyebrow')}</span>
            <h1 className="mt-3 text-4xl font-extrabold text-coal">{t('title')}</h1>
            <p className="mt-2 text-coal-2">{t('subtitle')}</p>
          </div>

          <div className="paper rounded-rxl p-8">
            {state.status === 'loading' && (
              <p className="py-10 text-center text-coal-2">{t('loading')}</p>
            )}

            {state.status === 'error' && (
              <div className="py-8 text-center">
                <p className="text-lg font-semibold text-coal">{t('agentDown')}</p>
                <p className="mt-2 text-sm text-coal-2">{state.message}</p>
                <button
                  className="mt-6 inline-flex items-center gap-2 rounded-r border border-hair-2 bg-card px-5 py-3 font-semibold text-coal-2 hover:text-coal"
                  onClick={() => void load()}
                >
                  <RefreshCw className="h-4 w-4" /> {t('retry')}
                </button>
              </div>
            )}

            {state.status === 'ready' && (
              <>
                {state.printers.length === 0 ? (
                  <p className="py-8 text-center text-coal-2">{t('empty')}</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {state.printers.map((name) => {
                      const active = name === selected;
                      return (
                        <li key={name}>
                          <button
                            className={`flex w-full items-center gap-4 rounded-rlg border px-5 py-4 text-left transition-colors ${
                              active
                                ? 'border-coral bg-coral/5'
                                : 'border-hair-2 bg-card hover:border-coral/40'
                            }`}
                            onClick={() => setSelected(name)}
                          >
                            <span
                              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-rlg ${
                                active ? 'bg-coral text-white' : 'bg-cream text-coal-2'
                              }`}
                            >
                              <Printer className="h-5 w-5" strokeWidth={2} />
                            </span>
                            <span className="flex-1">
                              <span className="block text-lg font-semibold text-coal">
                                {name}
                              </span>
                              {name === state.agentDefault && (
                                <span className="text-sm text-coal-2">{t('agentDefault')}</span>
                              )}
                            </span>
                            {active && <Check className="h-6 w-6 text-coral" strokeWidth={2.5} />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {testMsg && (
                  <p className="mt-5 text-center text-sm font-medium text-coal-2">{testMsg}</p>
                )}

                <div className="mt-8 flex gap-4">
                  <button
                    className="flex-1 rounded-r border border-hair-2 bg-card py-5 text-lg font-semibold text-coal-2 transition-colors hover:text-coal disabled:opacity-40"
                    onClick={test}
                    disabled={!selected}
                  >
                    {t('test')}
                  </button>
                  <button
                    className="flex-1 rounded-r bg-coral py-5 text-lg font-bold text-white shadow-coral transition-all hover:bg-coral-600 active:translate-y-px disabled:opacity-60"
                    onClick={save}
                    disabled={!selected}
                  >
                    {saved ? t('saved') : t('save')}
                  </button>
                </div>
              </>
            )}

            <div className="mt-6 text-center">
              <button
                className="text-sm font-medium text-coal-2 underline-offset-4 hover:text-coal hover:underline"
                onClick={() => router.push(`/${locale}`)}
              >
                {t('back')}
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
