import type { Request, Response, NextFunction } from 'express';

// Cycle L4 followup (feature/ldh) — 모든 JSON API 응답에 Cache-Control: no-store.
//
// 배경: 권한/세션 정보(/auth/me 의 role 등)에 캐시 금지 헤더가 없어, 브라우저가
// 디스크 캐시의 옛 응답을 재사용하면서 "역할 변경 즉시 반영"이 최초 1회 안 먹는
// 증상이 있었다(재로그인하면 일관 동작 — 서버는 매 요청 DB role 을 읽으므로 서버
// 로직 문제 아님). Cycle L2 followup 3 이 페이지 HTML 에 적용한 no-store 를 API
// 응답에도 확장한다.
//
// 예외(파일 다운로드 — 본문 이미지/첨부): no-store 를 붙이면 페이지를 열 때마다
// 첨부/이미지를 재다운로드해 로딩이 느려진다. 아래 GET 다운로드 라우트는 제외하고
// 기존(Cache-Control 헤더 없음 → 브라우저 휴리스틱 캐시) 동작을 그대로 유지한다.
//   - GET /attachments/:id                        (AttachmentsController.download)
//   - GET /share/:token/attachments/:attachmentId (PageSharesController.downloadAttachment)
// 이 두 경로의 이름이 바뀌면 아래 정규식도 함께 갱신할 것(리뷰에서 잡히도록 명시).
//
// 참고: API 는 setGlobalPrefix 없이 bare 경로(@Controller('auth') 등)로 라우팅되고,
// web 이 /api 를 스트립해 전달하므로 여기서 보는 req.path 에는 /api 접두가 없다.
const FILE_DOWNLOAD_PATHS = [
  /^\/attachments\/[^/]+$/,
  /^\/share\/[^/]+\/attachments\/[^/]+$/,
];

export function noStore(req: Request, res: Response, next: NextFunction): void {
  const isFileDownload =
    req.method === 'GET' &&
    FILE_DOWNLOAD_PATHS.some((re) => re.test(req.path));
  if (!isFileDownload) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
}
