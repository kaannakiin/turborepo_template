import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { CookieOptions, Response } from "express";
import type { Env } from "../../../config/env.schema";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_COOKIE_PATH,
  REFRESH_TOKEN_COOKIE,
} from "../identity.constants";

@Injectable()
export class AuthCookiesService {
  private readonly secure: boolean;
  private readonly domain: string | undefined;

  constructor(config: ConfigService<Env, true>) {
    this.secure = config.get("NODE_ENV", { infer: true }) === "production";
    this.domain = config.get("COOKIE_DOMAIN", { infer: true });
  }

  private base(path: string): CookieOptions {
    return {
      httpOnly: true,
      secure: this.secure,
      sameSite: "lax",
      path,
      ...(this.domain ? { domain: this.domain } : {}),
    };
  }

  setAuthCookies(
    res: Response,
    tokens: {
      accessToken: string;
      accessMaxAgeMs: number;
      refreshToken: string;
      refreshMaxAgeMs: number;
    },
  ): void {
    res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
      ...this.base("/"),
      maxAge: tokens.accessMaxAgeMs,
    });
    res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
      ...this.base(REFRESH_COOKIE_PATH),
      maxAge: tokens.refreshMaxAgeMs,
    });
  }

  // clearCookie only matches when path/domain match what set the cookie.
  clearAuthCookies(res: Response): void {
    res.clearCookie(ACCESS_TOKEN_COOKIE, this.base("/"));
    res.clearCookie(REFRESH_TOKEN_COOKIE, this.base(REFRESH_COOKIE_PATH));
  }
}
