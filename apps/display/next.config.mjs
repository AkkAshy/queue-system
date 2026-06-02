/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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

export default nextConfig;
