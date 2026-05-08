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
      { source: '/api/pages', destination: 'http://localhost:3001/pages' },
      {
        source: '/api/pages/:path*',
        destination: 'http://localhost:3001/pages/:path*',
      },
      {
        source: '/api/diagrams',
        destination: 'http://localhost:3001/diagrams',
      },
      {
        source: '/api/diagrams/:path*',
        destination: 'http://localhost:3001/diagrams/:path*',
      },
    ];
  },
};
export default nextConfig;
