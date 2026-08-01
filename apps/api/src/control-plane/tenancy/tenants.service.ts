import { Injectable } from "@nestjs/common";
import type { RoleSummary } from "@repo/contracts/control-plane/access";
import type { MyTenant } from "@repo/contracts/control-plane/tenancy";
import { MembershipStatus } from "@repo/database/enums";
import type {
  MembershipModel,
  RoleAssignmentModel,
  RoleModel,
  TenantModel,
} from "@repo/database/models";
import { PrismaService } from "../../prisma/prisma.service";

type MembershipRow = MembershipModel & {
  tenant: TenantModel;
  roleAssignments: (RoleAssignmentModel & { role: RoleModel })[];
};

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The caller's own tenants, resolved from memberships rather than from any
   * client-supplied id — this is the list a tenant switch is allowed to pick
   * from, so it must never widen.
   *
   * `userPublicId` because that is what the JWT carries; the BigInt row id
   * does not cross the wire.
   */
  async listForUser(userPublicId: string): Promise<MyTenant[]> {
    const rows = await this.prisma.membership.findMany({
      where: {
        user: { publicId: userPublicId, deletedAt: null },
        status: MembershipStatus.ACTIVE,
        tenant: { deletedAt: null },
      },
      include: {
        tenant: true,
        roleAssignments: { include: { role: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return rows.map(toContract);
  }
}

function toContract(row: MembershipRow): MyTenant {
  return {
    membership: {
      publicId: row.publicId,
      status: row.status,
      joinedAt: row.joinedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    },
    tenant: {
      publicId: row.tenant.publicId,
      slug: row.tenant.slug,
      name: row.tenant.name,
      status: row.tenant.status,
      createdAt: row.tenant.createdAt.toISOString(),
    },
    roles: row.roleAssignments.map(toRoleSummary),
  };
}

const toRoleSummary = (assignment: { role: RoleModel }): RoleSummary => ({
  publicId: assignment.role.publicId,
  key: assignment.role.key,
  name: assignment.role.name,
});
