import type { INestApplication } from "@nestjs/common";
import { PlatformRole } from "@repo/database/enums";
import request from "supertest";
import type { PrismaService } from "@api/prisma/prisma.service";
import {
  CHROME_UA,
  IPHONE_SAFARI_UA,
  NATIVE_APP_UA,
  createE2EApp,
  emailRegisterBody,
  truncateAll,
} from "../support/e2e-utils";

const EMAIL = "sessions@example.com";

interface SessionItem {
  publicId: string;
  current: boolean;
  device: { deviceType: string } | null;
}

describe("Session management (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let refreshToken: string;

  const bearerLogin = async (userAgent: string) =>
    request(app.getHttpServer())
      .post("/auth/login")
      .set("X-Client-Type", "mobile")
      .set("User-Agent", userAgent)
      .send({ method: "email", email: EMAIL, password: "password123" })
      .expect(200);

  beforeAll(async () => {
    ({ app, prisma } = await createE2EApp());
    await truncateAll(prisma);

    await request(app.getHttpServer())
      .post("/auth/register")
      .set("X-Client-Type", "mobile")
      .set("User-Agent", NATIVE_APP_UA)
      .send(emailRegisterBody(EMAIL))
      .expect(201);
    await bearerLogin(CHROME_UA);
    const latest = await bearerLogin(IPHONE_SAFARI_UA);
    accessToken = latest.body.accessToken as string;
    refreshToken = latest.body.refreshToken as string;
  });

  afterAll(async () => {
    await app.close();
  });

  it("lists every active session, marks exactly the caller as current, leaks no IP", async () => {
    const res = await request(app.getHttpServer())
      .get("/auth/sessions")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    const sessions = res.body as SessionItem[];
    expect(sessions).toHaveLength(3);
    expect(sessions.filter((s) => s.current)).toHaveLength(1);
    for (const session of sessions) {
      expect(session).not.toHaveProperty("ipAddress");
      expect(session).not.toHaveProperty("userAgent");
    }
    expect(sessions.some((s) => s.device?.deviceType === "DESKTOP")).toBe(true);
  });

  it("404s on a foreign or nonexistent session publicId", async () => {
    const bogus = await request(app.getHttpServer())
      .delete("/auth/sessions/zzzzzzzzzzzzzzzzzzzzzzzz")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(404);
    expect(bogus.body.code).toBe("errors.auth.sessionNotFound");

    const other = await request(app.getHttpServer())
      .post("/auth/register")
      .set("X-Client-Type", "mobile")
      .send(emailRegisterBody("intruder@example.com"))
      .expect(201);
    const victimSessions = await request(app.getHttpServer())
      .get("/auth/sessions")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const victimSid = (victimSessions.body as SessionItem[]).find(
      (s) => !s.current,
    )?.publicId;

    await request(app.getHttpServer())
      .delete(`/auth/sessions/${victimSid}`)
      .set("Authorization", `Bearer ${other.body.accessToken as string}`)
      .expect(404);
  });

  it("revokes one selected session", async () => {
    const before = await request(app.getHttpServer())
      .get("/auth/sessions")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const target = (before.body as SessionItem[]).find((s) => !s.current);

    await request(app.getHttpServer())
      .delete(`/auth/sessions/${target?.publicId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    const after = await request(app.getHttpServer())
      .get("/auth/sessions")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(after.body).toHaveLength(2);
  });

  it("revoke-others keeps only the current session alive", async () => {
    await request(app.getHttpServer())
      .post("/auth/sessions/revoke-others")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    const res = await request(app.getHttpServer())
      .get("/auth/sessions")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const sessions = res.body as SessionItem[];
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.current).toBe(true);
  });

  it("logout revokes the session; the access token survives only until its TTL", async () => {
    await request(app.getHttpServer())
      .post("/auth/logout")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    // Stateless access path: still 200 until exp — the accepted ≤15 min tail.
    await request(app.getHttpServer())
      .get("/auth/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    // The DB-backed refresh path is dead immediately.
    const res = await request(app.getHttpServer())
      .post("/auth/refresh")
      .set("X-Client-Type", "mobile")
      .send({ refreshToken })
      .expect(401);
    expect(res.body.code).toBe("errors.auth.refreshInvalid");
  });

  it("guards /platform/users by platform role and leaves /health public", async () => {
    await request(app.getHttpServer()).get("/health").expect(200);

    const unauthenticated = await request(app.getHttpServer())
      .get("/platform/users")
      .expect(401);
    expect(unauthenticated.body.code).toBe("errors.auth.unauthorized");

    const asUser = await request(app.getHttpServer())
      .get("/platform/users")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(403);
    expect(asUser.body.code).toBe("errors.http.forbidden");

    // The platform role lives in the JWT claim, so promotion requires a fresh login.
    await prisma.user.update({
      where: { email: EMAIL },
      data: { platformRole: PlatformRole.SUPERADMIN },
    });
    const adminLogin = await bearerLogin(CHROME_UA);
    await request(app.getHttpServer())
      .get("/platform/users")
      .set("Authorization", `Bearer ${adminLogin.body.accessToken as string}`)
      .expect(200);
  });
});
