import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import type { PrismaService } from "@api/prisma/prisma.service";
import {
  CHROME_UA,
  NATIVE_APP_UA,
  cookieValue,
  createE2EApp,
  emailRegisterBody,
  phoneRegisterBody,
  truncateAll,
} from "../support/e2e-utils";

describe("Auth register (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createE2EApp());
    await truncateAll(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it("registers with email over the web transport: cookies, no body tokens", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/register")
      .set("User-Agent", CHROME_UA)
      .send(emailRegisterBody("reg-web@example.com"))
      .expect(201);

    const setCookie = res.headers["set-cookie"] as unknown as string[];
    expect(cookieValue(setCookie, "access_token")).toBeDefined();
    expect(cookieValue(setCookie, "refresh_token")).toBeDefined();
    const refreshCookie = setCookie.find((c) => c.startsWith("refresh_token="));
    expect(refreshCookie).toContain("Path=/auth/refresh");
    expect(refreshCookie).toContain("HttpOnly");

    expect(res.body.user).toMatchObject({
      email: "reg-web@example.com",
      phone: null,
      status: "PENDING_VERIFICATION",
      platformRole: "NONE",
    });
    expect(res.body.accessToken).toBeUndefined();
    expect(res.body.refreshToken).toBeUndefined();
    expect(JSON.stringify(res.body).toLowerCase()).not.toContain("password");
  });

  it("rejects a duplicate email with 409 errors.auth.emailTaken", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/register")
      .send(emailRegisterBody("reg-web@example.com"))
      .expect(409);
    expect(res.body.code).toBe("errors.auth.emailTaken");
  });

  it("registers phone-only over the bearer transport: body tokens, no cookies, null email", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/register")
      .set("X-Client-Type", "mobile")
      .set("User-Agent", NATIVE_APP_UA)
      .send(phoneRegisterBody("+905321234567"))
      .expect(201);

    expect(res.headers["set-cookie"]).toBeUndefined();
    expect(typeof res.body.accessToken).toBe("string");
    expect(typeof res.body.refreshToken).toBe("string");
    expect(res.body.expiresIn).toBe(900);
    expect(res.body.user.email).toBeNull();
    expect(res.body.user.phone).toBe("+905321234567");
  });

  it("rejects a duplicate phone with 409 errors.auth.phoneTaken", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/register")
      .send(phoneRegisterBody("+905321234567"))
      .expect(409);
    expect(res.body.code).toBe("errors.auth.phoneTaken");
  });

  it("reports a password mismatch through the shared validation envelope", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/register")
      .send({
        ...emailRegisterBody("mismatch@example.com"),
        passwordConfirm: "different123",
      })
      .expect(400);

    expect(res.body).toMatchObject({
      statusCode: 400,
      code: "errors.validation.failed",
    });
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "validation.password.mismatch",
          path: "passwordConfirm",
        }),
      ]),
    );
  });

  it("rejects a structurally-plausible but unreal phone number", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/register")
      .send(phoneRegisterBody("+90123"))
      .expect(400);

    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "validation.phone.invalid" }),
      ]),
    );
  });

  it("localizes the error message per Accept-Language", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/register")
      .set("Accept-Language", "tr")
      .send(emailRegisterBody("reg-web@example.com"))
      .expect(409);

    expect(res.body.code).toBe("errors.auth.emailTaken");
    expect(res.body.message).toBe("Bu e-posta adresi zaten kayıtlı");
  });
});
