import { Controller, Get } from '@nestjs/common';
import type { Health } from '@repo/contracts';

@Controller('health')
export class HealthController {
  @Get()
  check(): Health {
    // Return type is the contract itself — a drift between api and web
    // becomes a compile error, not a runtime surprise.
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
