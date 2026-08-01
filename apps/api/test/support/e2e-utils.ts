import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AppModule } from "@api/app.module";
import { configureApp } from "@api/app.setup";
import { PrismaService } from "@api/prisma/prisma.service";

export interface E2EContext {
  app: INestApplication;
  prisma: PrismaService;
}

/**
 * Boots the real AppModule through the same configureApp() main.ts uses — a
 * test app must never drift from the production middleware stack.
 */
export async function createE2EApp(): Promise<E2EContext> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  return { app, prisma: app.get(PrismaService) };
}

export async function truncateAll(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "auth_tokens", "user_sessions", "user_devices", "users" RESTART IDENTITY CASCADE',
  );
}

export const CHROME_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export const IPHONE_SAFARI_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

export const NATIVE_APP_UA = "MyApp/1.0 (iPhone; iOS 17.5; Scale/3.00)";

export function emailRegisterBody(email: string) {
  return {
    method: "email",
    email,
    name: "Kaan",
    surname: "Akin",
    password: "password123",
    passwordConfirm: "password123",
  };
}

export function phoneRegisterBody(phone: string) {
  return {
    method: "phone",
    phone,
    name: "Kaan",
    surname: "Akin",
    password: "password123",
    passwordConfirm: "password123",
  };
}

export function cookieValue(
  setCookieHeader: string[] | string | undefined,
  name: string,
): string | undefined {
  const headers = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : setCookieHeader
      ? [setCookieHeader]
      : [];
  const match = headers.find((h) => h.startsWith(`${name}=`));
  return match?.split(";")[0]?.slice(name.length + 1);
}
