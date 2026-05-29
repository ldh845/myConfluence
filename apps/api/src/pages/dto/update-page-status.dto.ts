import { IsEnum, ValidateIf } from 'class-validator';
import { PageStatus } from '@prisma/client';

// Cycle 70 — 페이지 작업 상태 변경 body.
//   status=null 이면 상태 제거(배지 미표시). 그 외에는 PageStatus enum 값만 허용.
//   ValidateIf 로 null 은 검증을 건너뛰어 통과시키고, 비-null 일 때만 enum 검사.
export class UpdatePageStatusDto {
  @ValidateIf((o: UpdatePageStatusDto) => o.status !== null)
  @IsEnum(PageStatus)
  status!: PageStatus | null;
}
