import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Server } from '@hocuspocus/server';
import { Redis } from '@hocuspocus/extension-redis';

const HOCUSPOCUS_PORT = 1234;
const HOCUSPOCUS_HOST = '0.0.0.0';

@Injectable()
export class CollaborationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CollaborationService.name);
  private readonly redisHost = process.env.REDIS_HOST ?? 'localhost';
  private readonly redisPort = Number(process.env.REDIS_PORT ?? 6379);
  private readonly server: Server;

  constructor() {
    this.server = new Server({
      port: HOCUSPOCUS_PORT,
      address: HOCUSPOCUS_HOST,
      // Let Nest own SIGINT/SIGTERM so its shutdown hooks run; otherwise
      // Hocuspocus would call process.exit before Nest can clean up.
      stopOnSignals: false,
      extensions: [
        new Redis({
          host: this.redisHost,
          port: this.redisPort,
        }),
      ],
    });
  }

  async onModuleInit() {
    await this.server.listen();
    this.logger.log(
      `Hocuspocus listening on :${HOCUSPOCUS_PORT} with Redis adapter ${this.redisHost}:${this.redisPort}`,
    );
  }

  async onModuleDestroy() {
    await this.server.destroy();
  }
}
