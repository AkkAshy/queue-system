import path from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  outputFileTracingRoot: path.join(import.meta.dirname, '../../'),
  // Single-host path routing in prod (e.g. /operator). Unset in dev → served at /.
  basePath: process.env.APP_BASE_PATH || undefined,
  // Старые браузеры (Win7 Chrome, старые WebView) не парсят logical-assignment
  // (??=, ||=) из vendor-кода (react-query, radix, msw…). Транспилируем эти
  // node_modules под browserslist (см. package.json), иначе SyntaxError → белый
  // экран у оператора. Пульт на Win7 крутится в Chrome (WebView2 там мёртв).
  transpilePackages: [
    '@queue/types',
    '@queue/mocks',
    '@tanstack/react-query',
    '@tanstack/query-core',
    'msw',
    'zustand',
    '@radix-ui/react-dialog',
    '@radix-ui/react-label',
    '@radix-ui/react-select',
    '@radix-ui/react-slot',
    'lucide-react',
    'class-variance-authority',
    'tailwind-merge',
    'clsx',
    'sonner',
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
