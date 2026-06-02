import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Cycle 46 — liveness/readiness 분리.
//   GET /health/live  — 프로세스 생존만 확인 (DB 미접근, 즉시 200).
//                      K8s liveness probe 용 — DB 느릴 때 재시작 루프 위험 회피.
//   GET /health/ready — DB 연결 검사 (실패 시 503).
//                      K8s readiness probe + 로드밸런서 health check 용.
//   GET /health       — 호환 유지: readiness 와 동일 동작 (기존 호출자 무영향).
//                      K8s 환경에선 /live·/ready 사용 권장.

type LiveResponse = { status: 'ok' };
type ReadyResponse = { status: 'ok'; db: string };

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('live')
  live(): LiveResponse {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready(): Promise<ReadyResponse> {
    return this.checkDb();
  }

  @Get()
  async check(): Promise<ReadyResponse> {
    return this.checkDb();
  }

  private async checkDb(): Promise<ReadyResponse> {
    try {
      const rows = await this.prisma.$queryRawUnsafe<
        Array<Record<string, string>>
      >('SELECT version() AS version');
      const version = rows?.[0]?.version ?? 'unknown';
      return { status: 'ok', db: version };
    } catch (err) {
      throw new HttpException(
        {
          status: 'error',
          db: err instanceof Error ? err.message : 'unknown',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
