import { IsNotEmpty, IsString } from 'class-validator';

// Cycle 33 — PATCH /spaces/:id 의 홈 페이지 지정 body.
export class SetHomePageDto {
  @IsString()
  @IsNotEmpty()
  homePageId!: string;
}
