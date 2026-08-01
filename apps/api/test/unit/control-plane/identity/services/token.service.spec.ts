import type { ConfigService } from "@nestjs/config";
import type { JwtService } from "@nestjs/jwt";
import { SessionClientType } from "@repo/database/enums";
import type { UserModel } from "@repo/database/models";
import type { Env } from "@api/config/env.schema";
import { TokenService } from "@api/control-plane/identity/services/token.service";

const ENV: Record<string, string> = {
  JWT_ACCESS_TTL: "15m",
  REFRESH_TTL_WEB: "30d",
  REFRESH_TTL_MOBILE: "60d",
};

const configStub = {
  get: (key: string) => ENV[key],
} as unknown as ConfigService<Env, true>;

describe("TokenService", () => {
  const signAsync = jest.fn().mockResolvedValue("signed.jwt");
  const service = new TokenService(
    { signAsync } as unknown as JwtService,
    configStub,
  );

  it("hashes refresh tokens deterministically to 32 bytes", () => {
    const a = service.hashRefreshToken("some-token");
    const b = service.hashRefreshToken("some-token");
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
    expect(a).toHaveLength(32);
  });

  it("generates unique tokens whose hash matches hashRefreshToken", () => {
    const first = service.generateRefreshToken();
    const second = service.generateRefreshToken();
    expect(first.token).not.toBe(second.token);
    expect(
      Buffer.from(first.hash).equals(
        Buffer.from(service.hashRefreshToken(first.token)),
      ),
    ).toBe(true);
  });

  it("derives TTLs and ceilings from env per client type", () => {
    expect(service.accessTtlMilliseconds).toBe(15 * 60_000);
    expect(service.refreshTtlMilliseconds(SessionClientType.WEB)).toBe(
      30 * 86_400_000,
    );
    expect(service.refreshTtlMilliseconds(SessionClientType.MOBILE)).toBe(
      60 * 86_400_000,
    );
    expect(service.refreshCeilingMilliseconds(SessionClientType.WEB)).toBe(
      3 * 30 * 86_400_000,
    );
  });

  it("signs the exact access payload shape", async () => {
    const user = {
      publicId: "user-public-id",
      platformRole: "NONE",
    } as UserModel;
    const result = await service.signAccessToken(user, "session-public-id");

    expect(result).toEqual({ token: "signed.jwt", expiresInSeconds: 900 });
    expect(signAsync).toHaveBeenCalledWith({
      sub: "user-public-id",
      sid: "session-public-id",
      platformRole: "NONE",
      typ: "access",
    });
  });
});
