import { IsOptional, IsString } from 'class-validator';

export class UpdatePageDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  // parentId may be null (move to root) or a string id (re-parent).
  // Undefined means "do not touch".
  @IsOptional()
  @IsString()
  parentId?: string | null;

  // FR-022 (Cycle 18-3a) — 페이지 이동(스페이스 전환). 변경 시 자손 spaceId도
  // 트랜잭션 안에서 함께 동기화된다. parentId와 동시에 변경할 경우 parent의
  // spaceId가 target과 일치해야 한다.
  @IsOptional()
  @IsString()
  spaceId?: string;

  // FR-060 — 자동 버전 스냅샷에 attribution을 남기기 위한 필드.
  // page 컬럼으로 forward 하지 않고, 서비스에서 PageVersion에만 기록한다.
  @IsOptional()
  @IsString()
  authorName?: string;
}
