import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import type { Request } from "express";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { Env } from "../../../config/env.schema";
import type { Principal } from "../../../common/principal";
import { ACCESS_TOKEN_COOKIE } from "../identity.constants";
import { readCookie, type AccessTokenPayload } from "../identity.types";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService<Env, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: Request) => readCookie(req, ACCESS_TOKEN_COOKIE) ?? null,
      ]),
      secretOrKey: config.get("JWT_SECRET", { infer: true }),
      ignoreExpiration: false,
    });
  }

  validate(payload: AccessTokenPayload): Principal {
    if (payload.typ !== "access") {
      throw new UnauthorizedException({ code: "errors.auth.unauthorized" });
    }
    return {
      userId: payload.sub,
      sessionId: payload.sid,
      platformRole: payload.platformRole,
    };
  }
}
