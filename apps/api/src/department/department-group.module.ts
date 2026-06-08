import { Module } from '@nestjs/common';
import { DepartmentGroupService } from './department-group.service';

// Cycle L10 (feature/ldh) — 부서 자동 그룹 배정 서비스. AuthModule(로그인 동기화) 와
//   SpacesModule(공간 생성 기본 정책)이 각각 import. PrismaModule 은 @Global 이라 별도
//   import 불필요. AdminModule 과 분리해 Auth↔Admin 순환 의존을 피한다.
@Module({
  providers: [DepartmentGroupService],
  exports: [DepartmentGroupService],
})
export class DepartmentGroupModule {}
