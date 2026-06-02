import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// FR-001 (Cycle 27a) — JWT cookie 기반 보호. 명시적 @UseGuards(JwtAuthGuard).
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
