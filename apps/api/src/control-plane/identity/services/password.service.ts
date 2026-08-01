import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as argon2 from "argon2";
import type { Env } from "../../../config/env.schema";

const PRODUCTION_OPTIONS: argon2.HashOptions = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  hashLength: 32,
};

const TEST_OPTIONS: argon2.HashOptions = {
  type: argon2.argon2id,
  memoryCost: 2048,
  timeCost: 1,
  parallelism: 1,
  hashLength: 32,
};

/**
 * Exported so scripts that run outside the Nest container (src/scripts/seed.ts)
 * hash with the same parameters login verifies against. A second copy of these
 * numbers would drift and every seeded credential would need a rehash.
 */
export const resolvePasswordHashOptions = (
  nodeEnv: string | undefined,
): argon2.HashOptions =>
  nodeEnv === "test" ? TEST_OPTIONS : PRODUCTION_OPTIONS;

const DUMMY_HASH =
  "$argon2id$v=19$m=19456,p=1,t=2$AhE9aTxlHmcozgDyXjSD9Q$qE7HpgJmk0gLjGzd9V6YnVPpqNGIY2+ajQ/oMGQq52Y";

@Injectable()
export class PasswordService {
  private readonly options: argon2.HashOptions;

  constructor(config: ConfigService<Env, true>) {
    this.options = resolvePasswordHashOptions(
      config.get("NODE_ENV", { infer: true }),
    );
  }

  hash(plain: string): Promise<string> {
    return argon2.hash(plain, this.options);
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  async verifyDummy(plain: string): Promise<void> {
    await this.verify(DUMMY_HASH, plain);
  }

  needsRehash(hash: string): boolean {
    return argon2.needsRehash(hash, this.options);
  }
}
