import { Controller, Get } from "@nestjs/common";
import {
  PERMISSION_CATALOG_LIST,
  type PermissionCatalogEntry,
} from "@repo/contracts/control-plane/access";

/**
 * The catalog is code, so this endpoint reads nothing and needs no tenant
 * context — it exists so the role editor renders the same list the backend
 * enforces instead of shipping a second copy in the frontend bundle.
 *
 * Authenticated but unguarded beyond that: the global JwtAuthGuard covers it,
 * and a permission key is not a secret.
 */
@Controller("permissions")
export class PermissionsController {
  @Get()
  findAll(): readonly PermissionCatalogEntry[] {
    return PERMISSION_CATALOG_LIST;
  }
}
