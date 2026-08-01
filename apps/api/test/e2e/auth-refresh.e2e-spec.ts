import type { INestApplication } from "@nestjs/common";
import { SessionClientType, SessionRevokeReason } from "@repo/database/enums";
import request from "supertest";
import { TokenService } from "@api/control-plane/identity/services/token.service";
import type { PrismaService } from "@api/prisma/prisma.service";
import {
  CHROME_UA,
  cookieValue,
  createE2EApp,
  emailRegisterBody,
  phoneRegisterBody,
  truncateAll,
} from "../support/e2e-utils";

const EMAIL = "refresh-web@example.com";

describe("Auth refresh rotation (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createE2EApp());
    await truncateAll(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it("rotates web sessions and kills the whole family on replayed tokens", async () => {
    const agent = request.agent(app.getHttpServer());

    const registered = await agent
      .post("/auth/register")
      .set("User-Agent", CHROME_UA)
      .send(emailRegisterBody(EMAIL))
      .expect(201);
    const originalRefresh = cookieValue(
      registered.headers["set-cookie"] as unknown as string[],
      "refresh_token",
    );
    expect(originalRefresh).toBeDefined();

    const refreshed = await agent.post("/auth/refresh").expect(200);
    expect(refreshed.body.user.email).toBe(EMAIL);
    const rotatedRefresh = cookieValue(
      refreshed.headers["set-cookie"] as unknown as string[],
      "refresh_token",
    );
    expect(rotatedRefresh).toBeDefined();
    expect(rotatedRefresh).not.toBe(originalRefresh);

    const session = await prisma.userSession.findFirstOrThrow({
      where: { user: { email: EMAIL } },
    });
    expect(session.rotationCount).toBe(1);
    expect(session.previousTokenHash).not.toBeNull();

    // Replay inside the grace window: a benign multi-tab race, not theft.
    const graceReplay = await request(app.getHttpServer())
      .post("/auth/refresh")
      .set("Cookie", `refresh_token=${originalRefresh}`)
      .expect(401);
    expect(graceReplay.body.code).toBe("errors.auth.refreshInvalid");
    const afterGrace = await prisma.userSession.findUniqueOrThrow({
      where: { id: session.id },
    });
    expect(afterGrace.revokedAt).toBeNull();

    // Same replay outside the grace window: confirmed theft, family dies.
    await prisma.userSession.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date(Date.now() - 60_000) },
    });
    const theftReplay = await request(app.getHttpServer())
      .post("/auth/refresh")
      .set("Cookie", `refresh_token=${originalRefresh}`)
      .expect(401);
    expect(theftReplay.body.code).toBe("errors.auth.refreshReuseDetected");

    const revoked = await prisma.userSession.findUniqueOrThrow({
      where: { id: session.id },
    });
    expect(revoked.revokedAt).not.toBeNull();
    expect(revoked.revokeReason).toBe(SessionRevokeReason.TOKEN_REUSE_DETECTED);

    // The legitimate rotated token is dead too — the step reviews usually skip.
    const legitimateAfterTheft = await agent.post("/auth/refresh").expect(401);
    expect(legitimateAfterTheft.body.code).toBe("errors.auth.refreshInvalid");
  });

  it("rotates bearer sessions through the request body", async () => {
    const registered = await request(app.getHttpServer())
      .post("/auth/register")
      .set("X-Client-Type", "mobile")
      .send(phoneRegisterBody("+905341234567"))
      .expect(201);

    const refreshed = await request(app.getHttpServer())
      .post("/auth/refresh")
      .set("X-Client-Type", "mobile")
      .send({ refreshToken: registered.body.refreshToken })
      .expect(200);

    expect(typeof refreshed.body.refreshToken).toBe("string");
    expect(refreshed.body.refreshToken).not.toBe(registered.body.refreshToken);
    expect(refreshed.headers["set-cookie"]).toBeUndefined();
  });

  it("will not widen a web session to the mobile TTL via the client-type header", async () => {
    const email = "refresh-spoof@example.com";
    const tokens = app.get(TokenService);

    const registered = await request(app.getHttpServer())
      .post("/auth/register")
      .set("User-Agent", CHROME_UA)
      .send(emailRegisterBody(email))
      .expect(201);
    const webRefresh = cookieValue(
      registered.headers["set-cookie"] as unknown as string[],
      "refresh_token",
    );
    expect(webRefresh).toBeDefined();

    await request(app.getHttpServer())
      .post("/auth/refresh")
      .set("X-Client-Type", "mobile")
      .send({ refreshToken: webRefresh })
      .expect(200);

    const session = await prisma.userSession.findFirstOrThrow({
      where: { user: { email } },
    });
    expect(session.clientType).toBe(SessionClientType.WEB);
    expect(session.expiresAt.getTime()).toBeLessThanOrEqual(
      session.createdAt.getTime() +
        tokens.refreshCeilingMilliseconds(SessionClientType.WEB),
    );
    expect(session.expiresAt.getTime()).toBeLessThan(
      Date.now() + tokens.refreshTtlMilliseconds(SessionClientType.MOBILE),
    );
  });

  it("requires a credential on its own transport", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/refresh")
      .expect(401);
    expect(res.body.code).toBe("errors.auth.refreshRequired");
  });
});
