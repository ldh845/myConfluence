import { IsBoolean, IsOptional } from 'class-validator';

// Cycle 49 — PATCH /auth/me/prefs 부분 갱신. 옵셔널 필드만 — 미지정 값은 무변경.
// 향후 prefs 가 늘면 옵셔널 필드 추가만 하면 호환 유지.
export class UpdatePrefsDto {
  @IsOptional()
  @IsBoolean()
  showPersonalSpaceInSidebar?: boolean;
}
