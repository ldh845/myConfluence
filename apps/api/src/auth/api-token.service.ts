import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ApiTokenScope } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService, AuthUser } from './auth.service';

// Cycle L-API-1 (feature/ldh) — 프로그램 접근용 API 토큰 발급/검증/폐기.
//   보안 원칙:
//   - 평문 토큰은 발급 응답(createForUser)에서만 1회 반환. 그 외 어디에도 노출 금지
//     (목록/에러/로그 포함). 저장은 sha256 해시(tokenHash)만.
//   - 비교는 항상 해시로. 평문을 DB 에 두지 않는다.
//   인증 흐름(authenticateToken):
//   - Bearer 평문 → sha256 → ApiToken 조회 → revokedAt null + 미만료 → 발급자 user.
//   - 발급자가 비활성(isActive=false)이면 거부(L2 원칙 일관).
//   - lastUsedAt 은 분 단위 throttle 로 갱신(매 요청 write 부담 회피).
// Cycle L-API-3 (feature/ldh) — 토큰 스코프(READ / READ_WRITE). 발급 시 선택,
//   기본 READ_WRITE. 인증 결과에 scope 를 실어 보내면 인터셉터가 쓰기를 막는다.
//   스코프는 권한을 넓히지 않고 좁히기만 한다(주인 권한 위 상한선).

export { ApiTokenScope };

// 평문 토큰 접두. 사람이/로그에서 DocSpace 토큰임을 식별하고 시크릿 스캐너가
// 패턴으로 잡을 수 있게 한다.
const TOKEN_PREFIX = 'dsp_';
// 표시용으로 보관할 앞부분 길이('dsp_' + 8 chars).
const DISPLAY_PREFIX_LEN = TOKEN_PREFIX.length + 8;
// lastUsedAt 갱신 throttle(ms). 마지막 갱신이 이보다 오래됐을 때만 update.
const LAST_USED_THROTTLE_MS = 60_000;

// 발급 응답(평문 1회 포함). 목록 응답과 구분되는 타입.
export type IssuedApiToken = {
  id: string;
  name: string;
  // 평문 — 이 응답에서만 단 1회. 재조회 불가.
  token: string;
  tokenPrefix: string;
  scope: ApiTokenScope;
  expiresAt: Date | null;
  createdAt: Date;
};

// 목록/조회용(평문 없음).
export type ApiTokenView = {
  id: string;
  name: string;
  tokenPrefix: string;
  scope: ApiTokenScope;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
};

// 토큰 인증 성공 결과 — 발급자(주인) + 토큰 스코프. 인터셉터가 scope 로 쓰기를 판정.
export type ApiTokenAuth = {
  user: AuthUser;
  scope: ApiTokenScope;
};

// admin 전체 목록 — 소유자 정보 동반.
export type AdminApiTokenView = ApiTokenView & {
  userId: string;
  username: string;
  ownerName: string;
};

@Injectable()
export class ApiTokenService {
  private readonly logger = new Logger(ApiTokenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  private hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  // 암호학적 난수 32바이트 base64url + 'dsp_' 접두. 충돌 확률 무시 가능.
  private generate(): { raw: string; tokenHash: string; tokenPrefix: string } {
    const raw = TOKEN_PREFIX + randomBytes(32).toString('base64url');
    return {
      raw,
      tokenHash: this.hash(raw),
      tokenPrefix: raw.slice(0, DISPLAY_PREFIX_LEN),
    };
  }

  // 발급(본인). expiresInDays>0 이면 만료 설정, 아니면 무기한(null).
  // scope 미지정이면 READ_WRITE(기존 동작 보존). 평문(token)은 이 반환값에서만 노출.
  async createForUser(
    userId: string,
    name: string,
    expiresInDays?: number,
    scope: ApiTokenScope = ApiTokenScope.READ_WRITE,
  ): Promise<IssuedApiToken> {
    const { raw, tokenHash, tokenPrefix } = this.generate();
    const expiresAt =
      expiresInDays && expiresInDays > 0
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
        : null;
    const rec = await this.prisma.apiToken.create({
      data: { userId, name: name.trim(), tokenHash, tokenPrefix, scope, expiresAt },
    });
    return {
      id: rec.id,
      name: rec.name,
      token: raw,
      tokenPrefix: rec.tokenPrefix,
      scope: rec.scope,
      expiresAt: rec.expiresAt,
      createdAt: rec.createdAt,
    };
  }

  // 본인 토큰 목록(평문 없음). 폐기된 것도 포함(revokedAt 로 구분).
  async listForUser(userId: string): Promise<ApiTokenView[]> {
    const rows = await this.prisma.apiToken.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: this.viewSelect(),
    });
    return rows;
  }

  // 본인 토큰 폐기(즉시 무효). 남의 토큰 id 면 404(존재 노출 회피).
  // 이미 폐기됐으면 idempotent.
  async revokeForUser(userId: string, id: string): Promise<{ ok: true }> {
    const rec = await this.prisma.apiToken.findUnique({ where: { id } });
    if (!rec || rec.userId !== userId) {
      throw new NotFoundException({ error: 'token not found' });
    }
    if (!rec.revokedAt) {
      await this.prisma.apiToken.update({
        where: { id },
        data: { revokedAt: new Date() },
      });
    }
    return { ok: true };
  }

  // (admin) 전체 토큰 목록 — 소유자 동반. 평문 없음.
  async listAll(): Promise<AdminApiTokenView[]> {
    const rows = await this.prisma.apiToken.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        ...this.viewSelect(),
        userId: true,
        user: { select: { username: true, name: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      tokenPrefix: r.tokenPrefix,
      scope: r.scope,
      expiresAt: r.expiresAt,
      lastUsedAt: r.lastUsedAt,
      revokedAt: r.revokedAt,
      createdAt: r.createdAt,
      userId: r.userId,
      username: r.user.username,
      ownerName: r.user.name,
    }));
  }

  // (admin) 강제 폐기 — 누구의 토큰이든. 없으면 404. idempotent.
  async revokeAny(id: string): Promise<{ ok: true }> {
    const rec = await this.prisma.apiToken.findUnique({ where: { id } });
    if (!rec) {
      throw new NotFoundException({ error: 'token not found' });
    }
    if (!rec.revokedAt) {
      await this.prisma.apiToken.update({
        where: { id },
        data: { revokedAt: new Date() },
      });
    }
    return { ok: true };
  }

  // Bearer 평문 → 인증된 발급자 + 토큰 스코프({ user, scope }) 또는 null(거부).
  //   거부 사유(미존재/폐기/만료/비활성)는 구분 없이 null 로 반환 → 정보 노출 최소화.
  //   ApiTokenStrategy 가 이 결과로 success/fail 을 결정하고, scope 를 req 에 실어
  //   인터셉터가 쓰기를 막는다. 스코프는 권한을 넓히지 않는다(주인 권한 한도 유지).
  async authenticateToken(rawToken: string): Promise<ApiTokenAuth | null> {
    if (!rawToken || !rawToken.startsWith(TOKEN_PREFIX)) return null;
    const tokenHash = this.hash(rawToken);
    const rec = await this.prisma.apiToken.findUnique({ where: { tokenHash } });
    if (!rec) return null;
    if (rec.revokedAt) return null;
    if (rec.expiresAt && rec.expiresAt.getTime() <= Date.now()) return null;

    // 발급자 권한을 그대로 승계 — 쿠키 인증과 동일한 AuthUser 형태(findById 재사용).
    const user = await this.auth.findById(rec.userId);
    if (!user || !user.isActive) return null;

    await this.touchLastUsed(rec.id, rec.lastUsedAt);
    return { user, scope: rec.scope };
  }

  // lastUsedAt throttle 갱신. 갱신 실패가 인증을 막지 않도록 best-effort.
  private async touchLastUsed(
    id: string,
    lastUsedAt: Date | null,
  ): Promise<void> {
    const now = Date.now();
    if (lastUsedAt && now - lastUsedAt.getTime() <= LAST_USED_THROTTLE_MS) {
      return;
    }
    try {
      await this.prisma.apiToken.update({
        where: { id },
        data: { lastUsedAt: new Date(now) },
      });
    } catch (err) {
      this.logger.warn(
        `lastUsedAt 갱신 실패(token=${id}) — 인증은 계속`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  // 목록 응답 공통 select(평문/해시 제외).
  private viewSelect() {
    return {
      id: true,
      name: true,
      tokenPrefix: true,
      scope: true,
      expiresAt: true,
      lastUsedAt: true,
      revokedAt: true,
      createdAt: true,
    } as const;
  }
}
