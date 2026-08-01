import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { VerifyAck } from "@repo/contracts/control-plane/identity";
import type { Principal } from "../../../common/principal";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { VerifyConfirmDto, VerifyRequestDto } from "../dto/verify.dto";
import { VerifyService } from "../services/verify.service";

@Controller("auth/verify")
export class VerifyController {
  constructor(private readonly verify: VerifyService) {}

  @Throttle({ default: { limit: 3, ttl: 900_000 } })
  @HttpCode(HttpStatus.OK)
  @Post("request")
  request(
    @CurrentUser() principal: Principal,
    @Body() dto: VerifyRequestDto,
  ): Promise<VerifyAck> {
    return this.verify.request(principal, dto.purpose);
  }

  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  @HttpCode(HttpStatus.OK)
  @Post("confirm")
  confirm(
    @CurrentUser() principal: Principal,
    @Body() dto: VerifyConfirmDto,
  ): Promise<VerifyAck> {
    return this.verify.confirm(principal, dto.purpose, dto.code);
  }
}
