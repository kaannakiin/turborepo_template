import { SetMetadata } from "@nestjs/common";
import type { PlatformRole } from "@repo/database/enums";

export const ROLES_KEY = "roles";

export const Roles = (
  ...roles: PlatformRole[]
): MethodDecorator & ClassDecorator => SetMetadata(ROLES_KEY, roles);
