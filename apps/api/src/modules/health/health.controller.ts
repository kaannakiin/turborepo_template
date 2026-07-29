import { Controller, Get } from "@nestjs/common";
import type { Health } from "@repo/contracts/shared";

@Controller("health")
export class HealthController {
  @Get()
  check(): Health {
    return {
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
