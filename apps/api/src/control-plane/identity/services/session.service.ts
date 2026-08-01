import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import type { SessionList } from "@repo/contracts/control-plane/identity";
import {
  SessionClientType,
  SessionRevokeReason,
  UserStatus,
} from "@repo/database/enums";
import type { UserModel, UserSessionModel } from "@repo/database/models";
import { PrismaService } from "../../../prisma/prisma.service";
import { REFRESH_REUSE_GRACE_MS, SESSION_CAP } from "../identity.constants";
import { toSessionClientType } from "../identity.types";
import type { RequestContext } from "../identity.types";
import { TokenService } from "./token.service";

export interface CreatedSession {
  session: UserSessionModel;
  refreshToken: string;
}

export interface RotatedSession {
  user: UserModel;
  sessionPublicId: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async create(params: {
    userId: bigint;
    deviceId: bigint | null;
    context: RequestContext;
  }): Promise<CreatedSession> {
    const { userId, deviceId, context } = params;
    const now = new Date();
    const clientType = toSessionClientType(context.clientType);

    await this.evictBeyondCap(userId, now);

    const { token, hash } = this.tokens.generateRefreshToken();
    const session = await this.prisma.userSession.create({
      data: {
        userId,
        deviceId,
        clientType,
        refreshTokenHash: hash,
        ipAddress: context.ip,
        userAgent: context.userAgent,
        expiresAt: new Date(
          now.getTime() + this.tokens.refreshTtlMilliseconds(clientType),
        ),
      },
    });

    return { session, refreshToken: token };
  }

  async rotate(
    presentedToken: string,
    context: RequestContext,
  ): Promise<RotatedSession> {
    const presentedHash = this.tokens.hashRefreshToken(presentedToken);
    const now = new Date();

    const session = await this.prisma.userSession.findUnique({
      where: { refreshTokenHash: presentedHash },
      include: { user: true },
    });

    if (session && !session.revokedAt && session.expiresAt > now) {
      this.assertUsableAccount(session.user, session.id, now);

      if (toSessionClientType(context.clientType) !== session.clientType) {
        this.logger.warn(
          `Session ${session.id} was issued as ${session.clientType} but refreshed as ${context.clientType} — keeping the stored policy`,
        );
      }

      const { token: newToken, hash: newHash } =
        this.tokens.generateRefreshToken();
      const newExpiresAt = this.slideExpiry(
        session.createdAt,
        now,
        session.clientType,
      );

      const cas = await this.prisma.userSession.updateMany({
        where: {
          refreshTokenHash: presentedHash,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          previousTokenHash: presentedHash,
          refreshTokenHash: newHash,
          rotationCount: { increment: 1 },
          lastUsedAt: now,
          expiresAt: newExpiresAt,
          ipAddress: context.ip,
          userAgent: context.userAgent,
        },
      });

      if (cas.count === 1) {
        return {
          user: session.user,
          sessionPublicId: session.publicId,
          refreshToken: newToken,
          refreshExpiresAt: newExpiresAt,
        };
      }
    }

    await this.handleFailedRotation(presentedHash, now);
    throw new UnauthorizedException({ code: "errors.auth.refreshInvalid" });
  }

  private async handleFailedRotation(
    presentedHash: Uint8Array<ArrayBuffer>,
    now: Date,
  ): Promise<void> {
    const victim = await this.prisma.userSession.findFirst({
      where: { previousTokenHash: presentedHash, revokedAt: null },
      select: { id: true, familyId: true, lastUsedAt: true },
    });
    if (!victim) return;

    if (now.getTime() - victim.lastUsedAt.getTime() <= REFRESH_REUSE_GRACE_MS) {
      this.logger.warn(
        `Grace-window refresh replay on session ${victim.id} — not treated as theft`,
      );
      return;
    }

    await this.prisma.userSession.updateMany({
      where: { familyId: victim.familyId, revokedAt: null },
      data: {
        revokedAt: now,
        revokeReason: SessionRevokeReason.TOKEN_REUSE_DETECTED,
      },
    });
    throw new UnauthorizedException({
      code: "errors.auth.refreshReuseDetected",
    });
  }

  private assertUsableAccount(
    user: UserModel,
    sessionId: bigint,
    now: Date,
  ): void {
    if (user.status !== UserStatus.SUSPENDED && !user.deletedAt) return;

    void this.prisma.userSession
      .updateMany({
        where: { id: sessionId, revokedAt: null },
        data: {
          revokedAt: now,
          revokeReason: SessionRevokeReason.ADMIN_REVOKED,
        },
      })
      .catch((error: unknown) => {
        this.logger.error("Failed to revoke unusable-account session", error);
      });

    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException({ code: "errors.auth.accountSuspended" });
    }
    throw new UnauthorizedException({ code: "errors.auth.refreshInvalid" });
  }

  private slideExpiry(
    createdAt: Date,
    now: Date,
    clientType: SessionClientType,
  ): Date {
    const slid = now.getTime() + this.tokens.refreshTtlMilliseconds(clientType);
    const ceiling =
      createdAt.getTime() + this.tokens.refreshCeilingMilliseconds(clientType);
    return new Date(Math.min(slid, ceiling));
  }

  private async evictBeyondCap(userId: bigint, now: Date): Promise<void> {
    const active = await this.prisma.userSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: now } },
      orderBy: { lastUsedAt: "asc" },
      select: { id: true },
    });
    const excess = active.length - (SESSION_CAP - 1);
    if (excess <= 0) return;

    await this.prisma.userSession.updateMany({
      where: { id: { in: active.slice(0, excess).map((s) => s.id) } },
      data: { revokedAt: now },
    });
  }

  async list(userPublicId: string, currentSid: string): Promise<SessionList> {
    const rows = await this.prisma.userSession.findMany({
      where: {
        user: { publicId: userPublicId },
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastUsedAt: "desc" },
      include: { device: true },
    });

    return rows.map((row) => ({
      publicId: row.publicId,
      current: row.publicId === currentSid,
      device: row.device
        ? {
            publicId: row.device.publicId,
            displayName: row.device.displayName,
            deviceType: row.device.deviceType,
            osName: row.device.osName,
            browserName: row.device.browserName,
          }
        : null,
      city: row.city,
      countryCode: row.countryCode,
      createdAt: row.createdAt.toISOString(),
      lastUsedAt: row.lastUsedAt.toISOString(),
    }));
  }

  /** 404 whether the session is someone else's or nonexistent — the response
   * must not reveal that a guessed publicId belongs to a real session. */
  async revokeOne(
    userPublicId: string,
    sessionPublicId: string,
  ): Promise<void> {
    const result = await this.prisma.userSession.updateMany({
      where: {
        publicId: sessionPublicId,
        user: { publicId: userPublicId },
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokeReason: SessionRevokeReason.USER_REVOKED_SESSION,
      },
    });
    if (result.count === 0) {
      throw new NotFoundException({ code: "errors.auth.sessionNotFound" });
    }
  }

  async revokeOthers(userPublicId: string, currentSid: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: {
        user: { publicId: userPublicId },
        publicId: { not: currentSid },
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokeReason: SessionRevokeReason.USER_REVOKED_ALL,
      },
    });
  }

  async logout(currentSid: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { publicId: currentSid, revokedAt: null },
      data: {
        revokedAt: new Date(),
        revokeReason: SessionRevokeReason.USER_LOGOUT,
      },
    });
  }
}
