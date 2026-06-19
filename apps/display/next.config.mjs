import path from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  outputFileTracingRoot: path.join(import.meta.dirname, '../../'),
  // Single-host path routing in prod (/tablo). Unset in dev → served at /.
  basePath: process.env.APP_BASE_PATH || undefined,
  // Expose the basePath to client code so absolute asset fetches (voice clips
  // in public/voice/…) can prefix it — otherwise they 404 under /tablo and the
  // board silently falls back to the browser TTS voice.
  env: {
    NEXT_PUBLIC_BASE_PATH: process.env.APP_BASE_PATH || '',
  },
  // Старые WebView (X96 = Chromium 84) не парсят logical-assignment (??=, ||=)
  // из vendor-кода (react-query, msw и т.п.). Транспилируем эти node_modules
  // под browserslist (см. package.json), иначе SyntaxError → «Application error».
  transpilePackages: [
    '@queue/types',
    '@queue/mocks',
    '@tanstack/react-query',
    '@tanstack/query-core',
    'msw',
    'zustand',
    '@radix-ui/react-slot',
    'lucide-react',
    'class-variance-authority',
    'tailwind-merge',
    'clsx',
  ],
  // Phase 6: when MSW is off, proxy /api/* to the real Django backend.
  async rewrites() {
    if (process.env.NEXT_PUBLIC_USE_MSW === '0') {
      const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
      return [{ source: '/api/:path*', destination: `${api}/api/:path*` }];
    }
    return [];
  },
};

export default nextConfig;
