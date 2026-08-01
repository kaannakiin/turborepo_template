import { Controller, Get } from "@nestjs/common";
import type { MyTenant } from "@repo/contracts/control-plane/tenancy";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { Principal } from "../../common/principal";
import { TenantsService } from "./tenants.service";

@Controller("tenants")
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get()
  findMine(@CurrentUser() principal: Principal): Promise<MyTenant[]> {
    return this.tenants.listForUser(principal.userId);
  }
}
