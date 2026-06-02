/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@queue/types', '@queue/mocks'],
};

export default nextConfig;
