import path from 'node:path';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Standalone output for lean Docker images; trace from the monorepo root so
  // workspace packages (@queue/*) are bundled. Affects `next build` only.
  output: 'standalone',
  outputFileTracingRoot: path.join(import.meta.dirname, '../../'),
  transpilePackages: ['@queue/types', '@queue/mocks'],
  // Phase 6: when MSW is off, proxy /api/* to the real Django backend.
  async rewrites() {
    if (process.env.NEXT_PUBLIC_USE_MSW === '0') {
      const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
      return [{ source: '/api/:path*', destination: `${api}/api/:path*` }];
    }
    return [];
  },
};

export default withNextIntl(nextConfig);
