import type { INestApplication } from "@nestjs/common";
import { UserStatus } from "@repo/database/enums";
import request from "supertest";
import type { PrismaService } from "@api/prisma/prisma.service";
import {
  CHROME_UA,
  NATIVE_APP_UA,
  createE2EApp,
  emailRegisterBody,
  phoneRegisterBody,
  truncateAll,
} from "../support/e2e-utils";

const EMAIL = "login@example.com";
const PHONE = "+905331234567";

describe("Auth login (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createE2EApp());
    await truncateAll(prisma);
    await request(app.getHttpServer())
      .post("/auth/register")
      .send(emailRegisterBody(EMAIL))
      .expect(201);
    await request(app.getHttpServer())
      .post("/auth/register")
      .set("X-Client-Type", "mobile")
      .send(phoneRegisterBody(PHONE))
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it("produces byte-identical failure codes for wrong password and unknown user", async () => {
    const wrongPassword = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ method: "email", email: EMAIL, password: "wrong-password" })
      .expect(401);
    const unknownUser = await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        method: "email",
        email: "nobody@example.com",
        password: "wrong-password",
      })
      .expect(401);

    expect(wrongPassword.body.code).toBe("errors.auth.invalidCredentials");
    expect(unknownUser.body.code).toBe(wrongPassword.body.code);
  });

  it("logs in with email over web: httpOnly cookies, user-only body", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .set("User-Agent", CHROME_UA)
      .send({ method: "email", email: EMAIL, password: "password123" })
      .expect(200);

    expect(res.headers["set-cookie"]).toBeDefined();
    expect(res.body.user.email).toBe(EMAIL);
    expect(res.body.accessToken).toBeUndefined();
    expect(res.body.refreshToken).toBeUndefined();
  });

  it("logs in with phone over bearer: tokens in body, no Set-Cookie", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .set("X-Client-Type", "mobile")
      .set("User-Agent", NATIVE_APP_UA)
      .send({ method: "phone", phone: PHONE, password: "password123" })
      .expect(200);

    expect(res.headers["set-cookie"]).toBeUndefined();
    expect(typeof res.body.accessToken).toBe("string");
    expect(typeof res.body.refreshToken).toBe("string");
    expect(res.body.user.phone).toBe(PHONE);
  });

  it("blocks a SUSPENDED account only after the password is proven", async () => {
    await prisma.user.update({
      where: { email: EMAIL },
      data: { status: UserStatus.SUSPENDED },
    });

    const correctPassword = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ method: "email", email: EMAIL, password: "password123" })
      .expect(403);
    expect(correctPassword.body.code).toBe("errors.auth.accountSuspended");

    const wrongPassword = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ method: "email", email: EMAIL, password: "wrong-password" })
      .expect(401);
    expect(wrongPassword.body.code).toBe("errors.auth.invalidCredentials");

    await prisma.user.update({
      where: { email: EMAIL },
      data: { status: UserStatus.ACTIVE },
    });
  });

  it("rejects a malformed body with the shared validation envelope", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: EMAIL, password: "password123" })
      .expect(400);
    expect(res.body.code).toBe("errors.validation.failed");
  });

  it("translates the failure message for Accept-Language: tr", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .set("Accept-Language", "tr")
      .send({ method: "email", email: EMAIL, password: "wrong-password" })
      .expect(401);

    expect(res.body.code).toBe("errors.auth.invalidCredentials");
    expect(res.body.message).toBe("E-posta/telefon veya şifre hatalı");
  });
});
