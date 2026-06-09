// FR-001 (Cycle 27c) — Express Request에 user 타입 확장.
// JwtStrategy.validate가 채워주는 AuthUser 형태.

import 'express';

declare module 'express' {
  interface Request {
    user?: {
      id: string;
      username: string;
      name: string;
      department: string;
      role: 'ADMIN' | 'PART_LEADER' | 'DEVELOPER' | 'DESIGNER' | 'PM';
      createdAt: Date;
    };
    // Cycle L-API-3 (feature/ldh) — 토큰 인증 경로 표시. ApiTokenStrategy 가 채우고
    // ApiTokenScopeInterceptor 가 READ 토큰의 쓰기 차단에 사용. 쿠키 인증은 미설정.
    authVia?: 'cookie' | 'api-token';
    tokenScope?: 'READ' | 'READ_WRITE';
  }
}
