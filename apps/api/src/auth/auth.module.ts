import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { ApiTokenStrategy } from './api-token.strategy';
import { Oauth2ProxyStrategy } from './oauth2-proxy.strategy';
import { ApiTokenService } from './api-token.service';
import { ApiTokenScopeInterceptor } from './api-token-scope.interceptor';
import { ApiTokensController } from './api-tokens.controller';
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
  // Cycle L-AFS — oauth2-proxy 무상태 전략 등록. 헤더 있으면 자동 인증,
  //   없으면 fail → 다음 전략(jwt/api-token)으로 위임. AUTH_MODE 분기 불필요.
  //   기존 Oauth2ProxyMiddleware(상태ful 쿠키 발급)는 제거 — strategy 가 대체.
  providers: [
    AuthService,
    JwtStrategy,
    ApiTokenStrategy,
    Oauth2ProxyStrategy,
    ApiTokenService,
    { provide: APP_INTERCEPTOR, useClass: ApiTokenScopeInterceptor },
  ],
  // AdminModule(/admin/api-tokens)이 ApiTokenService 를 주입받을 수 있게 export.
  exports: [AuthService, ApiTokenService],
})
export class AuthModule {}
