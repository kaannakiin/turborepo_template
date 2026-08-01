import type { INestApplication } from "@nestjs/common";
import { PlatformRole } from "@repo/database/enums";
import request from "supertest";
import type { PrismaService } from "@api/prisma/prisma.service";
import {
  createE2EApp,
  emailRegisterBody,
  truncateAll,
} from "../support/e2e-utils";

const ADMIN_EMAIL = "admin@example.com";
const VICTIM_EMAIL = "victim@example.com";

describe("Admin users CRUD (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let victimPublicId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createE2EApp());
    await truncateAll(prisma);

    await request(app.getHttpServer())
      .post("/auth/register")
      .set("X-Client-Type", "mobile")
      .send(emailRegisterBody(ADMIN_EMAIL))
      .expect(201);
    await prisma.user.update({
      where: { email: ADMIN_EMAIL },
      data: { platformRole: PlatformRole.SUPERADMIN },
    });
    const adminLogin = await request(app.getHttpServer())
      .post("/auth/login")
      .set("X-Client-Type", "mobile")
      .send({ method: "email", email: ADMIN_EMAIL, password: "password123" })
      .expect(200);
    adminToken = adminLogin.body.accessToken as string;

    const victim = await request(app.getHttpServer())
      .post("/auth/register")
      .set("X-Client-Type", "mobile")
      .send(emailRegisterBody(VICTIM_EMAIL))
      .expect(201);
    victimPublicId = victim.body.user.publicId as string;
  });

  afterAll(async () => {
    await app.close();
  });

  it("creates users with a hashed password, never echoing it", async () => {
    const res = await request(app.getHttpServer())
      .post("/platform/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        email: "created@example.com",
        name: "Created",
        surname: "User",
        password: "password123",
      })
      .expect(201);

    expect(res.body.publicId).toBeDefined();
    expect(JSON.stringify(res.body).toLowerCase()).not.toContain("password");

    const row = await prisma.user.findUniqueOrThrow({
      where: { email: "created@example.com" },
    });
    expect(row.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it("soft-deletes: audit rows survive, sessions die, the address frees up", async () => {
    await request(app.getHttpServer())
      .delete(`/platform/users/${victimPublicId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(204);

    // Row still exists as a tombstone — the session audit trail is intact.
    const tombstone = await prisma.user.findFirstOrThrow({
      where: { publicId: victimPublicId },
    });
    expect(tombstone.deletedAt).not.toBeNull();
    expect(tombstone.email).toBeNull();
    const sessions = await prisma.userSession.findMany({
      where: { userId: tombstone.id },
    });
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions.every((s) => s.revokedAt !== null)).toBe(true);

    // Gone from the admin surface and from login.
    const list = await request(app.getHttpServer())
      .get("/platform/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(
      (list.body as { publicId: string }[]).some(
        (u) => u.publicId === victimPublicId,
      ),
    ).toBe(false);
    await request(app.getHttpServer())
      .get(`/platform/users/${victimPublicId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(404);
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ method: "email", email: VICTIM_EMAIL, password: "password123" })
      .expect(401);
    expect(login.body.code).toBe("errors.auth.invalidCredentials");

    // The tombstoned address can be registered again.
    await request(app.getHttpServer())
      .post("/auth/register")
      .send(emailRegisterBody(VICTIM_EMAIL))
      .expect(201);
  });

  it("404s a second delete of the same user", async () => {
    const res = await request(app.getHttpServer())
      .delete(`/platform/users/${victimPublicId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(404);
    expect(res.body.code).toBe("errors.users.notFound");
  });
});
