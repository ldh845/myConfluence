import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { noStore } from './common/no-store.middleware';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Cycle L-MCP (feature/ldh) — JSON body 크기 제한 1MB로 증가.
  //   컨플루언스 HTML → ProseMirror 변환 결과가 100KB 초과하여 413 에러 발생.
  //   사내망 환경이므로 보안 리스크 최소.
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));
  // FR-001 (Cycle 27a) — JwtStrategy가 httpOnly cookie에서 토큰 추출.
  app.use(cookieParser());
  // Cycle L4 followup (feature/ldh) — 권한/세션 응답의 디스크 캐시 잔재 차단.
  // 모든 JSON API 응답에 Cache-Control: no-store (파일 다운로드 라우트는 제외).
  app.use(noStore);
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  // Cycle L-API-4 (feature/ldh) — OpenAPI(Swagger) 명세. 사내 MCP/외부 연동 개발 지원.
  //   API 는 setGlobalPrefix 없는 bare 라우팅(/auth/me 식)이고, 프록시(nginx/Next)는
  //   `/api/` prefix 를 떼고 api 로 전달한다(nginx `location /api/ { proxy_pass .../; }`).
  //   따라서 Swagger 도 api 기준 **'docs'(/docs) + '/docs-json'** 로 등록한다(Cycle L-API-4
  //   followup 2). 그러면 외부 브라우저 주소는 prefix-strip 으로 `/api/docs`·`/api/docs-json`
  //   이 그대로 유지되며 api 의 /docs 로 매핑된다. Bearer 스킴('api-token')으로 Authorize 에
  //   dsp_ 토큰을 넣고 바로 호출 테스트 가능.
  //   ⚠️ 노출 게이트(Cycle L-API-4 followup): NODE_ENV 가 아니라 **전용 플래그
  //      ENABLE_API_DOCS === 'true'** 일 때만 setup → 라우트 등록(아니면 미등록 = 404).
  //      NODE_ENV 게이트는 "테스트 서버인데 NODE_ENV=production" 인 환경에서 명세를 막아버려
  //      분리했다. 이제 production 이어도 플래그만 켜면 노출되고, NODE_ENV 의 로깅·에러
  //      상세·최적화 동작은 건드리지 않는다. **미설정/false = 비활성(기본 안전)** — 실운영
  //      (AFS)은 플래그를 끄거나 미설정으로 두면 차단된다.
  if (process.env.ENABLE_API_DOCS === 'true') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('DocSpace API')
      .setDescription(
        'DocSpace REST API — 사내 MCP/외부 연동용. API 토큰(Authorization: Bearer dsp_...) ' +
          '또는 세션 쿠키로 인증. 토큰 발급/스코프/권한은 docs/MCP-INTEGRATION.md 참조.',
      )
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'dsp_*',
          description:
            'API 토큰 평문(POST /auth/tokens 로 발급한 dsp_... ). Authorize 에 토큰만 입력.',
        },
        'api-token',
      )
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, {
      jsonDocumentUrl: 'docs-json',
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();