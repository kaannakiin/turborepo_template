import { createHash, randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { SessionClientType } from "@repo/database/enums";
import type { UserModel } from "@repo/database/models";
import ms, { type StringValue } from "ms";
import type { Env } from "../../../config/env.schema";
import { REFRESH_CEILING_MULTIPLIER } from "../identity.constants";
import type { AccessTokenPayload } from "../identity.types";

export interface AccessToken {
  token: string;
  expiresInSeconds: number;
}

@Injectable()
export class TokenService {
  private readonly accessTtlMs: number;
  private readonly refreshTtlMs: Record<SessionClientType, number>;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService<Env, true>,
  ) {
    this.accessTtlMs = ms(
      config.get("JWT_ACCESS_TTL", { infer: true }) as StringValue,
    );
    this.refreshTtlMs = {
      [SessionClientType.WEB]: ms(
        config.get("REFRESH_TTL_WEB", { infer: true }) as StringValue,
      ),
      [SessionClientType.MOBILE]: ms(
        config.get("REFRESH_TTL_MOBILE", { infer: true }) as StringValue,
      ),
    };
  }

  async signAccessToken(
    user: Pick<UserModel, "publicId" | "platformRole">,
    sessionPublicId: string,
  ): Promise<AccessToken> {
    const payload: AccessTokenPayload = {
      sub: user.publicId,
      sid: sessionPublicId,
      platformRole: user.platformRole,
      typ: "access",
    };
    const token = await this.jwt.signAsync(payload);
    return { token, expiresInSeconds: Math.floor(this.accessTtlMs / 1000) };
  }

  get accessTtlMilliseconds(): number {
    return this.accessTtlMs;
  }

  refreshTtlMilliseconds(clientType: SessionClientType): number {
    return this.refreshTtlMs[clientType];
  }

  refreshCeilingMilliseconds(clientType: SessionClientType): number {
    return this.refreshTtlMs[clientType] * REFRESH_CEILING_MULTIPLIER;
  }

  generateRefreshToken(): { token: string; hash: Uint8Array<ArrayBuffer> } {
    const token = randomBytes(32).toString("base64url");
    return { token, hash: this.hashRefreshToken(token) };
  }

  hashRefreshToken(token: string): Uint8Array<ArrayBuffer> {
    return new Uint8Array(createHash("sha256").update(token, "utf8").digest());
  }
}
