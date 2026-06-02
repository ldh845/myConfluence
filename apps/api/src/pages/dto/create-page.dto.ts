import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePageDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsString()
  @IsNotEmpty()
  spaceId!: string;

  @IsOptional()
  @IsString()
  parentId?: string | null;

  // Cycle 35 — true면 publishedAt=null로 만들고, 사이드바 페이지 트리에서 숨긴다.
  // TopNav "만들기"는 draft=true로 보내 편집 창(draft)부터 시작하고, 사용자가
  // [업데이트] 시 publishedAt이 채워져 트리에 등장한다. 사이드바 ＋, 복사,
  // 공간 홈 자동생성 등 즉시 노출이 자연스러운 경로는 draft 미지정으로 둔다.
  @IsOptional()
  @IsBoolean()
  draft?: boolean;
}
