import path from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  outputFileTracingRoot: path.join(import.meta.dirname, '../../'),
  // Single-host path routing in prod (e.g. /admin). Unset in dev → served at /.
  basePath: process.env.APP_BASE_PATH || undefined,
  // Expose the basePath to client code so it can resolve static assets in
  // /public (e.g. default lola voice clips). APP_BASE_PATH is already passed
  // wherever admin is built (compose, CI, box), so no new build-arg is needed.
  env: { NEXT_PUBLIC_BASE_PATH: process.env.APP_BASE_PATH || '' },
  transpilePackages: ['@queue/types', '@queue/mocks'],
  // Phase 6: when MSW is off, proxy /api/* to the real Django backend so
  // frontend code keeps using same-origin relative paths (no CORS needed).
  async rewrites() {
    if (process.env.NEXT_PUBLIC_USE_MSW === '0') {
      const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
      return [
        { source: '/api/:path*',   destination: `${api}/api/:path*` },
        { source: '/media/:path*', destination: `${api}/media/:path*` },
      ];
    }
    return [];
  },
};

export default nextConfig;
