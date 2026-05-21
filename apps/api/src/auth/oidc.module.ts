import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth.module';
import { OidcController } from './oidc.controller';
import { OidcService } from './oidc.service';

// Cycle 43 — OIDC 입구를 별도 모듈로 분리. AuthModule(AuthService export)을
// import 해 계정 매핑/토큰 발급을 재사용. JwtModule/가드/jwt.strategy 무수정.
@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [OidcController],
  providers: [OidcService],
})
export class OidcModule {}
