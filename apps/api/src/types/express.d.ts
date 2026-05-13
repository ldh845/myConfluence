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
  }
}
