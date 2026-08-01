import { UnauthorizedException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { JwtService } from "@nestjs/jwt";
import { SessionClientType, SessionRevokeReason } from "@repo/database/enums";
import type { Env } from "@api/config/env.schema";
import type { PrismaService } from "@api/prisma/prisma.service";
import type { ClientType, RequestContext } from "@api/control-plane/identity/identity.types";
import { SessionService } from "@api/control-plane/identity/services/session.service";
import { TokenService } from "@api/control-plane/identity/services/token.service";

const ENV: Record<string, string> = {
  JWT_ACCESS_TTL: "15m",
  REFRESH_TTL_WEB: "30d",
  REFRESH_TTL_MOBILE: "60d",
};

const context: RequestContext = {
  clientType: "web",
  ip: "203.0.113.7",
  userAgent: "test-agent",
};

function buildMocks() {
  const userSession = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    updateMany: jest.fn(),
  };
  const prisma = { userSession } as unknown as PrismaService;
  const tokens = new TokenService(
    { signAsync: jest.fn() } as unknown as JwtService,
    { get: (key: string) => ENV[key] } as unknown as ConfigService<Env, true>,
  );
  return { userSession, service: new SessionService(prisma, tokens), tokens };
}

function activeSession(
  tokens: TokenService,
  presented: string,
  clientType: SessionClientType = SessionClientType.WEB,
) {
  const createdAt = new Date(Date.now() - 60_000);
  return {
    id: 1n,
    publicId: "sess-public-id",
    familyId: "family-uuid",
    clientType,
    createdAt,
    expiresAt: new Date(Date.now() + 86_400_000),
    revokedAt: null,
    lastUsedAt: new Date(),
    refreshTokenHash: tokens.hashRefreshToken(presented),
    user: {
      id: 10n,
      publicId: "user-public-id",
      platformRole: "NONE",
      status: "ACTIVE",
      deletedAt: null,
    },
  };
}

async function expectCode(
  promise: Promise<unknown>,
  code: string,
): Promise<void> {
  await expect(promise).rejects.toMatchObject({
    response: { code },
  });
}

describe("SessionService.rotate", () => {
  it("rotates in place with a compare-and-swap update", async () => {
    const { userSession, service, tokens } = buildMocks();
    const presented = "presented-refresh-token";
    const session = activeSession(tokens, presented);
    userSession.findUnique.mockResolvedValue(session);
    userSession.updateMany.mockResolvedValue({ count: 1 });

    const rotated = await service.rotate(presented, context);

    expect(rotated.sessionPublicId).toBe("sess-public-id");
    expect(rotated.refreshToken).not.toBe(presented);

    const call = userSession.updateMany.mock.calls[0]?.[0];
    expect(call.where).toMatchObject({ revokedAt: null });
    expect(
      Buffer.from(call.where.refreshTokenHash).equals(
        Buffer.from(tokens.hashRefreshToken(presented)),
      ),
    ).toBe(true);
    expect(
      Buffer.from(call.data.previousTokenHash).equals(
        Buffer.from(tokens.hashRefreshToken(presented)),
      ),
    ).toBe(true);
    expect(
      Buffer.from(call.data.refreshTokenHash).equals(
        Buffer.from(tokens.hashRefreshToken(rotated.refreshToken)),
      ),
    ).toBe(true);
    expect(call.data.rotationCount).toEqual({ increment: 1 });

    const ceiling =
      session.createdAt.getTime() +
      tokens.refreshCeilingMilliseconds(SessionClientType.WEB);
    expect(rotated.refreshExpiresAt.getTime()).toBeLessThanOrEqual(ceiling);
  });

  it("keeps the stored policy when the client-type header disagrees", async () => {
    const { userSession, service, tokens } = buildMocks();
    const presented = "web-issued-token";
    const session = activeSession(tokens, presented, SessionClientType.WEB);
    userSession.findUnique.mockResolvedValue(session);
    userSession.updateMany.mockResolvedValue({ count: 1 });

    const rotated = await service.rotate(presented, {
      ...context,
      clientType: "mobile",
    });

    const webCeiling =
      session.createdAt.getTime() +
      tokens.refreshCeilingMilliseconds(SessionClientType.WEB);
    expect(rotated.refreshExpiresAt.getTime()).toBeLessThanOrEqual(webCeiling);
    expect(rotated.refreshExpiresAt.getTime()).toBeLessThan(
      Date.now() + tokens.refreshTtlMilliseconds(SessionClientType.MOBILE),
    );
  });

  it("treats a previous-hash hit inside the grace window as a benign race", async () => {
    const { userSession, service } = buildMocks();
    userSession.findUnique.mockResolvedValue(null);
    userSession.findFirst.mockResolvedValue({
      id: 1n,
      familyId: "family-uuid",
      lastUsedAt: new Date(Date.now() - 2_000),
    });

    await expectCode(
      service.rotate("stale-token", context),
      "errors.auth.refreshInvalid",
    );
    expect(userSession.updateMany).not.toHaveBeenCalled();
  });

  it("revokes the whole family on a replay outside the grace window", async () => {
    const { userSession, service } = buildMocks();
    userSession.findUnique.mockResolvedValue(null);
    userSession.findFirst.mockResolvedValue({
      id: 1n,
      familyId: "family-uuid",
      lastUsedAt: new Date(Date.now() - 60_000),
    });
    userSession.updateMany.mockResolvedValue({ count: 2 });

    await expectCode(
      service.rotate("stolen-token", context),
      "errors.auth.refreshReuseDetected",
    );
    expect(userSession.updateMany).toHaveBeenCalledWith({
      where: { familyId: "family-uuid", revokedAt: null },
      data: expect.objectContaining({
        revokeReason: SessionRevokeReason.TOKEN_REUSE_DETECTED,
      }),
    });
  });

  it("rejects a token matching neither hash without any write", async () => {
    const { userSession, service } = buildMocks();
    userSession.findUnique.mockResolvedValue(null);
    userSession.findFirst.mockResolvedValue(null);

    await expect(service.rotate("garbage", context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(userSession.updateMany).not.toHaveBeenCalled();
    expect(userSession.create).not.toHaveBeenCalled();
  });

  it("falls through to the reuse branch when the CAS loses a concurrent race", async () => {
    const { userSession, service, tokens } = buildMocks();
    const presented = "raced-token";
    userSession.findUnique.mockResolvedValue(activeSession(tokens, presented));
    userSession.updateMany.mockResolvedValue({ count: 0 });
    userSession.findFirst.mockResolvedValue({
      id: 1n,
      familyId: "family-uuid",
      lastUsedAt: new Date(),
    });

    await expectCode(
      service.rotate(presented, context),
      "errors.auth.refreshInvalid",
    );
  });

  it("blocks a suspended account and revokes its session", async () => {
    const { userSession, service, tokens } = buildMocks();
    const presented = "suspended-token";
    const session = activeSession(tokens, presented);
    session.user.status = "SUSPENDED";
    userSession.findUnique.mockResolvedValue(session);
    userSession.updateMany.mockResolvedValue({ count: 1 });

    await expectCode(
      service.rotate(presented, context),
      "errors.auth.accountSuspended",
    );
  });
});

describe("SessionService.create", () => {
  async function createWith(clientType: ClientType) {
    const { userSession, service } = buildMocks();
    userSession.create.mockResolvedValue({ id: 1n });
    const before = Date.now();

    await service.create({
      userId: 10n,
      deviceId: null,
      context: { ...context, clientType },
    });

    return { data: userSession.create.mock.calls[0]?.[0].data, before };
  }

  it("persists a web session as WEB with the web TTL", async () => {
    const { data, before } = await createWith("web");

    expect(data.clientType).toBe(SessionClientType.WEB);
    expect(data.expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + 30 * 86_400_000,
    );
    expect(data.expiresAt.getTime()).toBeLessThan(before + 60 * 86_400_000);
  });

  it("persists a mobile session as MOBILE with the mobile TTL", async () => {
    const { data, before } = await createWith("mobile");

    expect(data.clientType).toBe(SessionClientType.MOBILE);
    expect(data.expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + 60 * 86_400_000,
    );
  });
});
