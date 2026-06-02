import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth.module';
import { SpacesModule } from '../spaces/spaces.module';
import { OidcController } from './oidc.controller';
import { OidcService } from './oidc.service';

// Cycle 43 — OIDC 입구를 별도 모듈로 분리. AuthModule(AuthService export)을
// import 해 계정 매핑/토큰 발급을 재사용. JwtModule/가드/jwt.strategy 무수정.
// Cycle 49 — callback 에서 spacesService.getOrCreatePersonal 호출(자동 생성).
//   AuthModule↔SpacesModule 순환 회피 위해 OidcModule 이 SpacesModule 을
//   import (SpacesModule 은 AuthModule 만 import → 순환 없음).
@Module({
  imports: [ConfigModule, AuthModule, SpacesModule],
  controllers: [OidcController],
  providers: [OidcService],
})
export class OidcModule {}
