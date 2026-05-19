// Cycle 40 — NestJS API 프록시 타깃 포트를 환경변수로 통제.
// API_PORT 는 apps/api/.env 의 PORT(NestJS가 실제로 listen하는 포트)와
// 반드시 같아야 한다. 미설정 시 기본값 3001 — 코드의 기본 PORT와 일치.
const apiPort = process.env.API_PORT || '3001';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `http://localhost:${apiPort}/:path*`,
      },
    ];
  },
};
export default nextConfig;
