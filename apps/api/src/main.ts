import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { noStore } from './common/no-store.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // FR-001 (Cycle 27a) — JwtStrategy가 httpOnly cookie에서 토큰 추출.
  app.use(cookieParser());
  // Cycle L4 followup (feature/ldh) — 권한/세션 응답의 디스크 캐시 잔재 차단.
  // 모든 JSON API 응답에 Cache-Control: no-store (파일 다운로드 라우트는 제외).
  app.use(noStore);
  app.enableCors({ origin: 'http://localhost:3000', credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
