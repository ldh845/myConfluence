import { IsIn } from 'class-validator';

// Cycle L4 (feature/ldh) — 로컬 전용 계정 역할 변경(PATCH /admin/users/:id/role) 입력.
// 전역 역할 source of truth 가 Keycloak realm role 인 SSO 계정은 여기서 못 바꾸므로
// (서비스 계층에서 400 거부), 허용 값은 로컬 계정이 가질 수 있는 ADMIN / DEVELOPER 둘뿐.
export class SetRoleDto {
  @IsIn(['ADMIN', 'DEVELOPER'])
  role!: 'ADMIN' | 'DEVELOPER';
}
