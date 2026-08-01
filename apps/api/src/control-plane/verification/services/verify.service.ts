import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { VerifyAck, VerifyPurpose } from "@repo/contracts/control-plane/identity";
import { AuthTokenPurpose, UserStatus } from "@repo/database/enums";
import type { UserModel } from "@repo/database/models";
import type { Env } from "../../../config/env.schema";
import { PrismaService } from "../../../prisma/prisma.service";
import { OTP_MAX_ATTEMPTS, OTP_TTL_MS } from "../verification.constants";
import type { Principal } from "../../../common/principal";

@Injectable()
export class VerifyService {
  private readonly logger = new Logger(VerifyService.name);
  private readonly isProduction: boolean;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.isProduction =
      config.get("NODE_ENV", { infer: true }) === "production";
  }

  async request(
    principal: Principal,
    purpose: VerifyPurpose,
  ): Promise<VerifyAck> {
    const user = await this.requireUser(principal);
    const target = this.targetFor(user, purpose);
    const now = new Date();
    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");

    // Single-active-token invariant: each outstanding token would otherwise
    // add its own attempt budget to the 6-digit brute-force surface. The
    // user-row lock serializes concurrent resends — without it, two
    // overlapping requests can each invalidate-then-create and leave two live
    // codes, of which confirm() only ever checks the newest.
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM users WHERE id = ${user.id} FOR UPDATE`;
      await tx.authToken.updateMany({
        where: { userId: user.id, purpose, consumedAt: null },
        data: { expiresAt: now },
      });
      await tx.authToken.create({
        data: {
          userId: user.id,
          purpose,
          target,
          tokenHash: this.hashCode(user.publicId, purpose, code),
          expiresAt: new Date(now.getTime() + OTP_TTL_MS),
        },
      });
    });

    // Delivery (mailer/SMS) is deliberately not wired yet; without this log
    // the code would be unreachable in development.
    if (!this.isProduction) {
      this.logger.debug(`Verification code for ${target}: ${code}`);
    }

    return { accepted: true };
  }

  async confirm(
    principal: Principal,
    purpose: VerifyPurpose,
    code: string,
  ): Promise<VerifyAck> {
    const user = await this.requireUser(principal);
    const now = new Date();

    const token = await this.prisma.authToken.findFirst({
      where: {
        userId: user.id,
        purpose,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!token) throw verifyInvalid();

    // Attempt is spent atomically before comparing, so a correct guess after
    // the cap is burned stays burned even under concurrent submissions.
    const spent = await this.prisma.authToken.updateMany({
      where: {
        id: token.id,
        consumedAt: null,
        attemptCount: { lt: OTP_MAX_ATTEMPTS },
      },
      data: { attemptCount: { increment: 1 } },
    });
    if (spent.count === 0) throw verifyInvalid();

    const expected = this.hashCode(user.publicId, purpose, code);
    if (!timingSafeEqual(expected, token.tokenHash)) throw verifyInvalid();

    // Address changed since the token was issued: verifying would stamp the
    // wrong address as confirmed.
    if (token.target !== this.targetFor(user, purpose)) {
      throw new BadRequestException({
        code: "errors.auth.verifyTargetMismatch",
      });
    }

    const consumed = await this.prisma.authToken.updateMany({
      where: { id: token.id, consumedAt: null },
      data: { consumedAt: now },
    });
    if (consumed.count === 0) throw verifyInvalid();

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        ...(purpose === AuthTokenPurpose.EMAIL_VERIFICATION
          ? { emailVerifiedAt: now }
          : { phoneVerifiedAt: now }),
        ...(user.status === UserStatus.PENDING_VERIFICATION
          ? { status: UserStatus.ACTIVE }
          : {}),
      },
    });

    return { accepted: true };
  }

  private async requireUser(principal: Principal): Promise<UserModel> {
    const user = await this.prisma.user.findFirst({
      where: { publicId: principal.userId, deletedAt: null },
    });
    if (!user) {
      throw new UnauthorizedException({ code: "errors.auth.unauthorized" });
    }
    return user;
  }

  private targetFor(user: UserModel, purpose: VerifyPurpose): string {
    const target =
      purpose === AuthTokenPurpose.EMAIL_VERIFICATION ? user.email : user.phone;
    if (!target) {
      throw new BadRequestException({
        code: "errors.auth.verifyTargetMissing",
      });
    }
    return target;
  }

  // publicId and purpose in the preimage: a 6-digit code alone collides
  // across users, and tokenHash carries a global unique index. Copied into a
  // fresh Uint8Array because Prisma's Bytes fields reject Buffer's backing
  // type.
  private hashCode(
    userPublicId: string,
    purpose: VerifyPurpose,
    code: string,
  ): Uint8Array<ArrayBuffer> {
    return new Uint8Array(
      createHash("sha256")
        .update(`${userPublicId}:${purpose}:${code}`)
        .digest(),
    );
  }
}

const verifyInvalid = (): BadRequestException =>
  new BadRequestException({ code: "errors.auth.verifyInvalid" });
