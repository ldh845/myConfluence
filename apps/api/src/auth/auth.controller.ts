import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService, AuthUser } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

// FR-001 / FR-002 (Cycle 27a) — 인증 라우트.
//  POST /auth/signup  — 가입(자동 로그인 포함)
//  POST /auth/login   — 로그인
//  POST /auth/logout  — cookie 클리어
//  GET  /auth/me      — 현재 사용자 (cookie 필수)

@Controller('auth')
export class AuthController {
  private readonly cookieName: string;
  private readonly cookieSecure: boolean;
  private readonly cookieSameSite: 'lax' | 'strict' | 'none';
  private readonly maxAgeMs: number;

  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {
    this.cookieName = config.get<string>('COOKIE_NAME', 'docspace_session');
    this.cookieSecure = config.get<string>('COOKIE_SECURE') === 'true';
    const ss = (
      config.get<string>('COOKIE_SAMESITE') ?? 'lax'
    ).toLowerCase();
    this.cookieSameSite =
      ss === 'strict' ? 'strict' : ss === 'none' ? 'none' : 'lax';
    // JWT_EXPIRES_IN은 zeit/ms 형식(예: "7d"). 쿠키 max-age 계산은 단순화 —
    // 7d 기본. 사용자가 다른 값을 줘도 쿠키는 7d로 둠 (토큰 자체 exp가 진실).
    this.maxAgeMs = 7 * 24 * 60 * 60 * 1000;
  }

  private setCookie(res: Response, token: string) {
    res.cookie(this.cookieName, token, {
      httpOnly: true,
      secure: this.cookieSecure,
      sameSite: this.cookieSameSite,
      path: '/',
      maxAge: this.maxAgeMs,
    });
  }

  @Post('signup')
  @HttpCode(200)
  async signup(
    @Body() dto: SignupDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, token } = await this.auth.signup(dto);
    this.setCookie(res, token);
    return { user };
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, token } = await this.auth.login(dto);
    this.setCookie(res, token);
    return { user };
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(this.cookieName, { path: '/' });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request): { user: AuthUser } {
    const user = (req as Request & { user?: AuthUser }).user;
    return { user: user as AuthUser };
  }
}
