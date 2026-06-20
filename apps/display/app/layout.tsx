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
  title: 'NMPI · Tablo',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" className={rubik.variable} suppressHydrationWarning>
      <head>
        {/* Полифиллы для старого WebView (X96 = Chromium 84): методы Chrome 85-98,
            которых нет в vendor-коде (React 19/Next) после транспиляции синтаксиса. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){function at(n){n=Math.trunc(n)||0;if(n<0)n+=this.length;if(n<0||n>=this.length)return undefined;return this[n];}function def(o,k,v){if(!o[k])Object.defineProperty(o,k,{value:v,configurable:true,writable:true});}def(Array.prototype,'at',at);def(String.prototype,'at',at);if(!Object.hasOwn)Object.hasOwn=function(o,p){return Object.prototype.hasOwnProperty.call(o,p);};def(Array.prototype,'findLast',function(cb,th){for(var i=this.length-1;i>=0;i--){if(cb.call(th,this[i],i,this))return this[i];}});def(Array.prototype,'findLastIndex',function(cb,th){for(var i=this.length-1;i>=0;i--){if(cb.call(th,this[i],i,this))return i;}return -1;});def(String.prototype,'replaceAll',function(s,r){return this.split(s).join(r);});if(typeof structuredClone==='undefined')window.structuredClone=function(o){return o==null?o:JSON.parse(JSON.stringify(o));};})();",
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
