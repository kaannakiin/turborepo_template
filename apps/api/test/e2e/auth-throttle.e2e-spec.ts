import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import type { PrismaService } from "@api/prisma/prisma.service";
import { createE2EApp, truncateAll } from "../support/e2e-utils";

describe("Auth throttling (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    // skipIf reads this per request, so enabling it here scopes real
    // throttling to this spec file only.
    process.env.THROTTLE_E2E = "1";
    ({ app, prisma } = await createE2EApp());
    await truncateAll(prisma);
  });

  afterAll(async () => {
    delete process.env.THROTTLE_E2E;
    await app.close();
  });

  it("429s the sixth rapid login attempt with a localized code", async () => {
    const attempt = () =>
      request(app.getHttpServer()).post("/auth/login").send({
        method: "email",
        email: "burst@example.com",
        password: "wrong-password",
      });

    for (let i = 0; i < 5; i++) {
      await attempt().expect(401);
    }

    const throttled = await attempt().expect(429);
    expect(throttled.body.code).toBe("errors.http.tooManyRequests");
  });
});
