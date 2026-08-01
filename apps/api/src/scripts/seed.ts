import {
  PERMISSION_KEYS,
  resolvePermissions,
  type Permission,
} from "@repo/contracts/control-plane/access";
import { MembershipStatus, UserStatus } from "@repo/database/enums";
import { createPrismaClient, type PrismaClient } from "@repo/database/server";
import * as argon2 from "argon2";
import { config as loadEnv } from "dotenv";
import { resolvePasswordHashOptions } from "../control-plane/identity/services/password.service";

// Same single root file the API reads through ConfigModule's envFilePath and
// the Prisma CLI reads through prisma.config.ts; both resolve it from cwd.
loadEnv({ path: "../../.env", quiet: true });

/**
 * System roles carry `tenantId = null`: valid in every tenant, not editable by
 * tenant admins. `key` is the stable identifier — `name` is display text and
 * may be translated or changed without breaking assignments.
 */
const SYSTEM_ROLES: ReadonlyArray<{
  key: string;
  name: string;
  description: string;
  permissions: readonly Permission[];
}> = [
  {
    key: "owner",
    name: "Sahip",
    description: "Kiracı üzerinde tam yetki.",
    permissions: PERMISSION_KEYS,
  },
  {
    key: "admin",
    name: "Yönetici",
    description: "Üye, rol ve oturum yönetimi.",
    permissions: resolvePermissions([
      "tenant:update",
      "member:invite",
      "member:update",
      "member:remove",
      "role:create",
      "role:update",
      "role:delete",
      "session:revoke",
    ]),
  },
  {
    key: "member",
    name: "Üye",
    description: "Yalnızca görüntüleme.",
    permissions: resolvePermissions(["tenant:read", "member:read"]),
  },
];

// Edited here rather than read from the environment: turbo's strict env mode
// would need every one of these declared as a task input, and a fixture that
// only ever runs locally does not earn that.
const DEV_ACCOUNT = {
  email: "dev@example.com",
  password: "password123",
  name: "Dev",
  surname: "User",
  tenantSlug: "dev",
  tenantName: "Dev Tenant",
} as const;

async function seedSystemRoles(prisma: PrismaClient): Promise<void> {
  for (const role of SYSTEM_ROLES) {
    // Not `upsert`: the compound unique is (tenantId, key) and Prisma cannot
    // target a NULL component of a compound unique in `where`. The partial
    // unique index on key WHERE tenantId IS NULL is what makes this race-safe.
    const existing = await prisma.role.findFirst({
      where: { tenantId: null, key: role.key },
      select: { id: true },
    });

    if (existing) {
      await prisma.role.update({
        where: { id: existing.id },
        data: {
          name: role.name,
          description: role.description,
          permissions: [...role.permissions],
        },
      });
      continue;
    }

    await prisma.role.create({
      data: {
        tenantId: null,
        key: role.key,
        name: role.name,
        description: role.description,
        permissions: [...role.permissions],
      },
    });
  }

  console.log(`Seeded ${SYSTEM_ROLES.length} system roles.`);
}

/**
 * A login-ready account with a known password. Guarded on NODE_ENV because the
 * credential is published in this file — it must never reach a deployment.
 */
async function seedDevAccount(prisma: PrismaClient): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    console.log("NODE_ENV=production — skipping the dev account.");
    return;
  }

  const passwordHash = await argon2.hash(
    DEV_ACCOUNT.password,
    resolvePasswordHashOptions(process.env.NODE_ENV),
  );

  const user = await prisma.user.upsert({
    where: { email: DEV_ACCOUNT.email },
    update: {},
    create: {
      email: DEV_ACCOUNT.email,
      passwordHash,
      name: DEV_ACCOUNT.name,
      surname: DEV_ACCOUNT.surname,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
    select: { id: true, publicId: true },
  });

  const tenant = await prisma.tenant.upsert({
    where: { slug: DEV_ACCOUNT.tenantSlug },
    update: {},
    create: { slug: DEV_ACCOUNT.tenantSlug, name: DEV_ACCOUNT.tenantName },
    select: { id: true, publicId: true },
  });

  const membership = await prisma.membership.upsert({
    where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
    update: { status: MembershipStatus.ACTIVE },
    create: {
      userId: user.id,
      tenantId: tenant.id,
      status: MembershipStatus.ACTIVE,
      joinedAt: new Date(),
    },
    select: { id: true, publicId: true },
  });

  const owner = await prisma.role.findFirstOrThrow({
    where: { tenantId: null, key: "owner" },
    select: { id: true },
  });

  await prisma.roleAssignment.upsert({
    where: {
      membershipId_roleId: { membershipId: membership.id, roleId: owner.id },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      membershipId: membership.id,
      roleId: owner.id,
    },
  });

  console.log(
    [
      "Dev account ready:",
      `  email      ${DEV_ACCOUNT.email}`,
      `  password   ${DEV_ACCOUNT.password}`,
      `  user       ${user.publicId}`,
      `  tenant     ${tenant.publicId} (${DEV_ACCOUNT.tenantSlug})`,
      `  membership ${membership.publicId} — owner`,
    ].join("\n"),
  );
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to seed.");
  }

  // Not a Nest application context: the seed runs under tsx, which does not
  // emit `design:paramtypes`, so constructor injection resolves to undefined.
  // The one thing worth sharing with the container — the argon2 parameters —
  // is imported directly instead.
  const prisma = createPrismaClient(connectionString);

  try {
    await seedSystemRoles(prisma);
    await seedDevAccount(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
