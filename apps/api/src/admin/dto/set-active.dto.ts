import { IsBoolean } from 'class-validator';

// Cycle L2 (feature/ldh) — 계정 활성/비활성 토글(PATCH /admin/users/:id/active) 입력.
export class SetActiveDto {
  @IsBoolean()
  isActive!: boolean;
}
