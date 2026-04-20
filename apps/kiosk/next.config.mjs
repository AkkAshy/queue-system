/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@queue/types', '@queue/mocks'],
  experimental: {
    reactCompiler: false,
  },
};

export default nextConfig;
