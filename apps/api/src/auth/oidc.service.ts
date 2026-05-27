import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Issuer, generators } from 'openid-client';
import type { Client } from 'openid-client';

// Cycle 43 — Keycloak OIDC(authorization code + PKCE) 입구.
// openid-client v5(CJS) 사용 — v6 은 ESM-only 라 NestJS(CommonJS)에서 require 불가.
// 토큰 검증(서명 JWKS / issuer / aud / exp / nonce)은 client.callback() 이 수행.

export type OidcAuthRequest = {
  url: string;
  state: string;
  nonce: string;
  codeVerifier: string;
};

export type OidcClaims = {
  sub: string;
  username: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  // Cycle 48 — Keycloak realm role 목록(예: ["admin", "user"]). ID token 의
  // `realm_access.roles` 에서 추출. ADMIN 권한의 source of truth — 매 로그인마다
  // findOrCreateOidcUser 가 DocSpace User.role 을 이 값으로 동기화한다.
  realmRoles?: string[];
};

@Injectable()
export class OidcService {
  private readonly logger = new Logger(OidcService.name);
  private clientPromise: Promise<Client> | null = null;

  private readonly issuerUri: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(private readonly config: ConfigService) {
    this.issuerUri = this.config.get<string>(
      'KC_ISSUER_URI',
      'http://localhost:8080/realms/docspace',
    );
    this.clientId = this.config.get<string>('KC_CLIENT_ID', 'docspace-web');
    this.clientSecret = this.config.get<string>(
      'KC_CLIENT_SECRET',
      'dev-docspace-secret',
    );
    this.redirectUri = this.config.get<string>(
      'OIDC_REDIRECT_URI',
      'http://localhost:3000/api/auth/oidc/callback',
    );
  }

  // 지연 discovery — 첫 요청 때 1회. 부팅을 Keycloak 가용성에 묶지 않고,
  // 실패 시 캐시를 비워 다음 요청에서 재시도.
  private getClient(): Promise<Client> {
    if (!this.clientPromise) {
      this.clientPromise = Issuer.discover(this.issuerUri)
        .then((issuer) => {
          this.logger.log(`OIDC issuer discovered: ${issuer.metadata.issuer}`);
          return new issuer.Client({
            client_id: this.clientId,
            client_secret: this.clientSecret,
            redirect_uris: [this.redirectUri],
            response_types: ['code'],
          });
        })
        .catch((err: unknown) => {
          this.clientPromise = null;
          throw err;
        });
    }
    return this.clientPromise;
  }

  // GET /auth/oidc/login — Keycloak authorization endpoint URL + state/nonce/PKCE.
  async createAuthRequest(): Promise<OidcAuthRequest> {
    const client = await this.getClient();
    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);
    const state = generators.state();
    const nonce = generators.nonce();
    const url = client.authorizationUrl({
      scope: 'openid profile email',
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    return { url, state, nonce, codeVerifier };
  }

  // GET /auth/oidc/callback — code→token 교환 + ID 토큰 검증 후 클레임 추출.
  // idToken(raw)도 함께 반환 — 로그아웃 시 end_session 의 id_token_hint 로 쓴다.
  async handleCallback(
    params: Record<string, unknown>,
    checks: { state: string; nonce: string; codeVerifier: string },
  ): Promise<{ claims: OidcClaims; idToken?: string }> {
    const client = await this.getClient();
    const tokenSet = await client.callback(
      this.redirectUri,
      params as Parameters<Client['callback']>[1],
      {
        state: checks.state,
        nonce: checks.nonce,
        code_verifier: checks.codeVerifier,
      },
    );
    const c = tokenSet.claims();
    const username =
      (c.preferred_username as string | undefined) ??
      (c.email as string | undefined) ??
      c.sub;
    // Cycle 48 — Keycloak realm roles 추출. ID token 의 `realm_access.roles` 가
    // 표준 위치. 클라이언트 scope 설정에 따라 누락될 수 있어 옵셔널.
    const realmAccess = c.realm_access as { roles?: string[] } | undefined;
    const realmRoles = Array.isArray(realmAccess?.roles)
      ? (realmAccess.roles as string[])
      : undefined;
    return {
      claims: {
        sub: c.sub,
        username,
        email: c.email,
        emailVerified: c.email_verified as boolean | undefined,
        name: c.name,
        realmRoles,
      },
      idToken: tokenSet.id_token,
    };
  }

  // POST/GET logout — Keycloak end_session_endpoint URL 빌드(단일 로그아웃, SLO).
  // id_token_hint 가 있으면 Keycloak 확인 페이지 없이 바로 SSO 세션을 끊고
  // post_logout_redirect_uri 로 돌아온다.
  async buildEndSessionUrl(
    idToken: string,
    postLogoutRedirectUri: string,
  ): Promise<string> {
    const client = await this.getClient();
    return client.endSessionUrl({
      id_token_hint: idToken,
      post_logout_redirect_uri: postLogoutRedirectUri,
    });
  }
}
