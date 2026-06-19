import type { Metadata } from 'next';
import { Rubik } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const rubik = Rubik({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  variable: '--font-rubik',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'NDPI · Tablo',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" className={rubik.variable} suppressHydrationWarning>
      <head>
        {/* TEMP диагностика Chromium 84 (X96): ловим JS-ошибки и показываем на экране. Убрать после. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){function show(m){var b=document.getElementById('__err');if(!b){b=document.createElement('div');b.id='__err';b.style.cssText='position:fixed;left:0;bottom:0;z-index:99999;max-height:45vh;overflow:auto;background:#000;color:#0f0;font:13px monospace;padding:8px;white-space:pre-wrap;width:100%';(document.body||document.documentElement).appendChild(b);}b.textContent+=m+'\\n';}window.addEventListener('error',function(e){show('ERR: '+((e.error&&e.error.stack)||e.message||'?')+' @'+(e.filename||'')+':'+(e.lineno||''));});window.addEventListener('unhandledrejection',function(e){show('REJECT: '+((e.reason&&(e.reason.stack||e.reason.message))||e.reason||'?'));});})();",
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}",
          }}
        />
      </head>
      <body className="h-screen w-screen overflow-hidden bg-cream font-sans text-coal antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
