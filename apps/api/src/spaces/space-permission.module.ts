import { Module } from '@nestjs/common';
import { SpacePermissionService } from './space-permission.service';

// Cycle 74-A — 권한 판정 서비스를 spaces/pages 양쪽에서 쓰도록 분리한 모듈.
//   PrismaModule 은 @Global 이라 별도 import 불필요. 순환 의존 회피용 독립 모듈.
@Module({
  providers: [SpacePermissionService],
  exports: [SpacePermissionService],
})
export class SpacePermissionModule {}
