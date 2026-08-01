import { Controller, Get } from "@nestjs/common";
import type { Health } from "@repo/contracts/shared";
import { Public } from "../common/decorators/public.decorator";

@Public()
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
