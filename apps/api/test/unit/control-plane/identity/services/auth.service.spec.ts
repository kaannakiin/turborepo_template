import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import type { LoginRequest } from "@repo/contracts/control-plane/identity";
import type { PrismaService } from "@api/prisma/prisma.service";
import { AuthService } from "@api/control-plane/identity/services/auth.service";
import type { DeviceService } from "@api/control-plane/identity/services/device.service";
import type { PasswordService } from "@api/control-plane/identity/services/password.service";
import type { SessionService } from "@api/control-plane/identity/services/session.service";
import type { TokenService } from "@api/control-plane/identity/services/token.service";

const emailLogin: LoginRequest = {
  method: "email",
  email: "jane@example.com",
  password: "password123",
};

function buildService() {
  const user = {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
  };
  const passwords = {
    hash: jest.fn().mockResolvedValue("$argon2id$hash"),
    verify: jest.fn(),
    verifyDummy: jest.fn().mockResolvedValue(undefined),
    needsRehash: jest.fn().mockReturnValue(false),
  };
  const service = new AuthService(
    { user } as unknown as PrismaService,
    passwords as unknown as PasswordService,
    {} as TokenService,
    {} as SessionService,
    {} as DeviceService,
  );
  return { user, passwords, service };
}

const activeUser = {
  id: 1n,
  publicId: "user-public-id",
  email: "jane@example.com",
  phone: null,
  passwordHash: "$argon2id$stored",
  status: "ACTIVE",
  platformRole: "NONE",
  deletedAt: null,
};

describe("AuthService.validateCredentials", () => {
  it("burns a dummy verification for an unknown identifier", async () => {
    const { user, passwords, service } = buildService();
    user.findFirst.mockResolvedValue(null);

    await expect(service.validateCredentials(emailLogin)).rejects.toMatchObject(
      { response: { code: "errors.auth.invalidCredentials" } },
    );
    expect(passwords.verifyDummy).toHaveBeenCalledWith("password123");
  });

  it("always filters soft-deleted users out of the lookup", async () => {
    const { user, service } = buildService();
    user.findFirst.mockResolvedValue(null);

    await expect(
      service.validateCredentials(emailLogin),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(user.findFirst).toHaveBeenCalledWith({
      where: { email: "jane@example.com", deletedAt: null },
    });
  });

  it("returns the same code for a wrong password as for an unknown user", async () => {
    const { user, passwords, service } = buildService();
    user.findFirst.mockResolvedValue(activeUser);
    passwords.verify.mockResolvedValue(false);

    await expect(service.validateCredentials(emailLogin)).rejects.toMatchObject(
      { response: { code: "errors.auth.invalidCredentials" } },
    );
  });

  it("gates on status only after the password is proven correct", async () => {
    const { user, passwords, service } = buildService();
    user.findFirst.mockResolvedValue({ ...activeUser, status: "SUSPENDED" });
    passwords.verify.mockResolvedValue(true);

    await expect(
      service.validateCredentials(emailLogin),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(passwords.verify).toHaveBeenCalled();
  });

  it("lets a PENDING_VERIFICATION user in", async () => {
    const { user, passwords, service } = buildService();
    user.findFirst.mockResolvedValue({
      ...activeUser,
      status: "PENDING_VERIFICATION",
    });
    passwords.verify.mockResolvedValue(true);

    await expect(
      service.validateCredentials(emailLogin),
    ).resolves.toMatchObject({ publicId: "user-public-id" });
  });

  it("looks up phone logins by normalized E.164", async () => {
    const { user, passwords, service } = buildService();
    user.findFirst.mockResolvedValue({
      ...activeUser,
      email: null,
      phone: "+905321234567",
    });
    passwords.verify.mockResolvedValue(true);

    await service.validateCredentials({
      method: "phone",
      phone: "+905321234567",
      password: "password123",
    });
    expect(user.findFirst).toHaveBeenCalledWith({
      where: { phone: "+905321234567", deletedAt: null },
    });
  });

  it("rehashes on login without touching passwordChangedAt", async () => {
    const { user, passwords, service } = buildService();
    user.findFirst.mockResolvedValue(activeUser);
    passwords.verify.mockResolvedValue(true);
    passwords.needsRehash.mockReturnValue(true);

    await service.validateCredentials(emailLogin);

    const updateArgs = user.update.mock.calls[0]?.[0];
    expect(updateArgs.data).toHaveProperty("passwordHash");
    expect(updateArgs.data).not.toHaveProperty("passwordChangedAt");
  });
});
