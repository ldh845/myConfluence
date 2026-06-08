import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { ApiTokenStrategy } from './api-token.strategy';
import { ApiTokenService } from './api-token.service';
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
  providers: [AuthService, JwtStrategy, ApiTokenStrategy, ApiTokenService],
  // AdminModule(/admin/api-tokens)이 ApiTokenService 를 주입받을 수 있게 export.
  exports: [AuthService, ApiTokenService],
})
export class AuthModule {}
