import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { ApiTokenStrategy } from './api-token.strategy';
import { ApiTokenService } from './api-token.service';
import { ApiTokenScopeInterceptor } from './api-token-scope.interceptor';
import { ApiTokensController } from './api-tokens.controller';
import { Oauth2ProxyMiddleware } from './oauth2-proxy.middleware';
import { DepartmentGroupModule } from '../department/department-group.module';

@Module({
  imports: [
    PassportModule,
    // Cycle L10 — 로그인 시 부서 그룹 자동 배정.
    DepartmentGroupModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET') ?? 'dev-fallback';
        const expiresIn = config.get<string>('JWT_EXPIRES_IN') ?? '7d';
        // signOptions.expiresIn 타입이 jsonwebtoken과 좁아 cast.
        return {
          secret,
          signOptions: { expiresIn: expiresIn as unknown as number },
        };
      },
    }),
  ],
  controllers: [AuthController, ApiTokensController],
  // Cycle L-API-1 — API 토큰 서비스/전략 등록. ApiTokenStrategy 가 passport 에
  // 'api-token' 으로 등록되어 멀티 전략 가드(['jwt','api-token'])가 동작한다.
  // Cycle L-API-3 — 스코프 enforcement 인터셉터를 전역 등록(APP_INTERCEPTOR).
  //   토큰 인증이 req 에 심은 authVia/tokenScope 로 READ 토큰의 쓰기를 403 차단.
  //   쿠키 인증·public 라우트엔 authVia 가 없어 no-op.
  providers: [
    AuthService,
    JwtStrategy,
    ApiTokenStrategy,
    ApiTokenService,
    Oauth2ProxyMiddleware,
    { provide: APP_INTERCEPTOR, useClass: ApiTokenScopeInterceptor },
  ],
  // AdminModule(/admin/api-tokens)이 ApiTokenService 를 주입받을 수 있게 export.
  exports: [AuthService, ApiTokenService],
})
export class AuthModule implements NestModule {
  constructor(private readonly config: ConfigService) {}

  configure(consumer: MiddlewareConsumer): void {
    // AUTH_MODE=oauth2-proxy 일 때만 미들웨어 활성화.
    // 미설정 또는 다른 값이면 기존 OIDC/로컬 로그인 흐름 유지.
    const authMode = this.config.get<string>('AUTH_MODE', '').toLowerCase();
    if (authMode === 'oauth2-proxy') {
      consumer.apply(Oauth2ProxyMiddleware).forRoutes('*');
    }
  }
}
