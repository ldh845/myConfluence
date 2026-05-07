/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: '/api/spaces', destination: 'http://localhost:3001/spaces' },
      {
        source: '/api/spaces/:path*',
        destination: 'http://localhost:3001/spaces/:path*',
      },
    ];
  },
};
export default nextConfig;
