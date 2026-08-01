import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { CreateUser, UpdateUser, User } from "@repo/contracts/control-plane/platform";
import { SessionRevokeReason } from "@repo/database/enums";
import type { UserModel } from "@repo/database/models";
import { hasPrismaCode, isUniqueViolation } from "../../common/prisma-errors";
import { PrismaService } from "../../prisma/prisma.service";
import { PasswordService } from "../identity/services/password.service";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
  ) {}

  async findAll(): Promise<User[]> {
    const rows = await this.prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toContract);
  }

  async findOne(publicId: string): Promise<User> {
    const row = await this.prisma.user.findFirst({
      where: { publicId, deletedAt: null },
    });
    if (!row) throw userNotFound(publicId);
    return toContract(row);
  }

  async create(input: CreateUser): Promise<User> {
    const { password, ...rest } = input;
    const passwordHash = await this.passwords.hash(password);
    try {
      const row = await this.prisma.user.create({
        data: { ...rest, passwordHash },
      });
      return toContract(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw emailTaken(input.email);
      }
      throw error;
    }
  }

  async update(publicId: string, input: UpdateUser): Promise<User> {
    const existing = await this.prisma.user.findFirst({
      where: { publicId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) throw userNotFound(publicId);

    try {
      const row = await this.prisma.user.update({
        where: { id: existing.id },
        data: input,
      });
      return toContract(row);
    } catch (error) {
      if (isNotFound(error)) {
        throw userNotFound(publicId);
      }
      if (isUniqueViolation(error)) {
        throw emailTaken(input.email ?? "");
      }
      throw error;
    }
  }

  /**
   * Soft delete, never `user.delete()`: a hard delete would cascade-erase the
   * session/device/token audit trail and instantly free the email/phone for
   * re-registration. Nulling email/phone is the tombstone the schema comment
   * on User.deletedAt requires — the unique constraints are global, so the
   * address could otherwise never be registered again.
   */
  async remove(publicId: string): Promise<void> {
    const existing = await this.prisma.user.findFirst({
      where: { publicId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) throw userNotFound(publicId);

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: existing.id },
        data: { deletedAt: now, email: null, phone: null },
      }),
      this.prisma.userSession.updateMany({
        where: { userId: existing.id, revokedAt: null },
        data: {
          revokedAt: now,
          revokeReason: SessionRevokeReason.ADMIN_REVOKED,
        },
      }),
    ]);
  }
}

/**
 * The `code` is an @repo/i18n translation key; the exception filter localizes
 * it per request and echoes it verbatim as the wire-level error code.
 */
const userNotFound = (id: string): NotFoundException =>
  new NotFoundException({ code: "errors.users.notFound", params: { id } });

const emailTaken = (email: string): ConflictException =>
  new ConflictException({ code: "errors.users.emailTaken", params: { email } });

/**
 * DB row -> wire type. This function is the entire reason the contract is not
 * simply `UserModel`: Postgres hands back `createdAt` as a `Date`, JSON can
 * only carry a string. Every value crossing the wire converts here.
 */
function toContract(row: UserModel): User {
  return {
    publicId: row.publicId,
    email: row.email,
    name: row.name,
    surname: row.surname,
    platformRole: row.platformRole,
    createdAt: row.createdAt.toISOString(),
  };
}

const isNotFound = (error: unknown): boolean => hasPrismaCode(error, "P2025");
