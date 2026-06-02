import { SetMetadata } from '@nestjs/common';

// Cycle 48 — @Roles('ADMIN', ...) 데코레이터. RolesGuard 와 함께 사용.
// 컨트롤러·핸들러 메타데이터에 허용 역할 목록을 부착하면 RolesGuard 가 검사.
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
