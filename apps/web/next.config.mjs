import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Cycle 40 — NestJS API 프록시 타깃 포트를 환경변수로 통제.
// Cycle 42 — 컨테이너에서는 web 이 api 컨테이너에 서비스명으로 닿아야 하므로
//   호스트를 API_HOST 로 분리(기본 localhost — npm run dev:all 동작 불변).
//   주의: rewrites() 는 빌드 시점에 평가된다. 컨테이너 빌드는 API_HOST/API_PORT
//   를 빌드 ARG 로 주입(Dockerfile 참조). 포트 컨벤션(3001)은 그대로 유지.
const apiHost = process.env.API_HOST || 'localhost';
const apiPort = process.env.API_PORT || '3001';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Cycle 42 — Docker 이미지 경량화를 위한 standalone 출력.
  output: 'standalone',
  experimental: {
    // 모노레포 — standalone 파일 트레이싱 루트를 저장소 루트로 잡아야
    // workspace 의존성이 누락되지 않는다.
    outputFileTracingRoot: path.join(__dirname, '../../'),
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `http://${apiHost}:${apiPort}/:path*`,
      },
    ];
  },
};
export default nextConfig;
