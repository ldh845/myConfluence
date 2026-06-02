import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Server, type Extension } from '@hocuspocus/server';
import { Redis } from '@hocuspocus/extension-redis';

const HOCUSPOCUS_PORT = 1234;
const HOCUSPOCUS_HOST = '0.0.0.0';

// Cycle 39 — Redis 어댑터를 환경변수로 토글한다.
// 단일 인스턴스(사내 PC / 단일 서버)는 메모리 모드로 충분하고, Redis 미설치
// 환경에서도 onModuleInit이 실패하지 않는다. 멀티 인스턴스 확장 시에만
// USE_REDIS=true 로 켠다.
function shouldUseRedis(): boolean {
  const raw = (process.env.USE_REDIS ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

@Injectable()
export class CollaborationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CollaborationService.name);
  private readonly useRedis = shouldUseRedis();
  private readonly redisHost = process.env.REDIS_HOST ?? 'localhost';
  private readonly redisPort = Number(process.env.REDIS_PORT ?? 6379);
  private readonly server: Server;

  constructor() {
    const extensions: Extension[] = [];
    if (this.useRedis) {
      extensions.push(
        new Redis({
          host: this.redisHost,
          port: this.redisPort,
        }),
      );
    }
    this.server = new Server({
      port: HOCUSPOCUS_PORT,
      address: HOCUSPOCUS_HOST,
      // Let Nest own SIGINT/SIGTERM so its shutdown hooks run; otherwise
      // Hocuspocus would call process.exit before Nest can clean up.
      stopOnSignals: false,
      extensions,
    });
  }

  async onModuleInit() {
    await this.server.listen();
    if (this.useRedis) {
      this.logger.log(
        `Hocuspocus listening on :${HOCUSPOCUS_PORT} with Redis adapter ${this.redisHost}:${this.redisPort}`,
      );
    } else {
      this.logger.log(
        `Hocuspocus listening on :${HOCUSPOCUS_PORT} (in-memory, single instance) — set USE_REDIS=true for multi-instance`,
      );
    }
  }

  async onModuleDestroy() {
    await this.server.destroy();
  }
}
