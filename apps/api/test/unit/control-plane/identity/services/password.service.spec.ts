import type { ConfigService } from "@nestjs/config";
import * as argon2 from "argon2";
import type { Env } from "@api/config/env.schema";
import { PasswordService } from "@api/control-plane/identity/services/password.service";

// SWC's CJS interop hands each importer its own namespace copy, so spying on
// this spec's copy would never see the service's calls — the module registry
// itself has to carry the wrapped verify.
jest.mock("argon2", () => {
  const actual = jest.requireActual<typeof import("argon2")>("argon2");
  return { ...actual, verify: jest.fn(actual.verify) };
});

const configStub = {
  get: () => "test",
} as unknown as ConfigService<Env, true>;

describe("PasswordService", () => {
  const service = new PasswordService(configStub);

  it("round-trips hash and verify", async () => {
    const hash = await service.hash("correct horse battery staple");
    expect(hash).toMatch(/^\$argon2id\$/);
    await expect(
      service.verify(hash, "correct horse battery staple"),
    ).resolves.toBe(true);
    await expect(service.verify(hash, "wrong password")).resolves.toBe(false);
  });

  it("never throws on a malformed stored hash", async () => {
    await expect(service.verify("not-a-hash", "anything")).resolves.toBe(false);
  });

  it("does not flag a fresh hash for rehash", async () => {
    const hash = await service.hash("some password");
    expect(service.needsRehash(hash)).toBe(false);
  });

  it("burns a real argon2 verification on the dummy path", async () => {
    // Anti-enumeration guard: if verifyDummy ever stops calling the real
    // argon2.verify, unknown identifiers fail measurably faster than wrong
    // passwords and login becomes a timing oracle for account existence.
    const spy = argon2.verify as jest.MockedFunction<typeof argon2.verify>;
    spy.mockClear();

    await service.verifyDummy("any password");

    expect(spy).toHaveBeenCalledWith(
      expect.stringMatching(/^\$argon2id\$/) as unknown as string,
      "any password",
    );
    await expect(spy.mock.results[0]?.value).resolves.toBe(false);
  });
});
