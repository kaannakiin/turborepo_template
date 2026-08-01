import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  type LoginResponse,
  type LogoutResponse,
  type RegisterRequest,
  type SessionList,
  type SessionUser,
} from "@repo/contracts/control-plane/identity";
import type { UserModel } from "@repo/database/models";
import type { Request, Response } from "express";
import { ZodValidationPipe } from "nestjs-zod";
import { AuthCookiesService } from "../services/auth-cookies.service";
import { AuthService, type IssuedTokens } from "../services/auth.service";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { Public } from "../../../common/decorators/public.decorator";
import type { Principal } from "../../../common/principal";
import { requestContext, type RequestContext } from "../identity.types";
import { RefreshToken } from "../decorators/refresh-token.decorator";
import { registerRequestSchema } from "../dto/register.schema";
import { LocalAuthGuard } from "../guards/local-auth.guard";
import { RefreshTokenGuard } from "../guards/refresh-token.guard";
import { SessionService } from "../services/session.service";
import { TokenService } from "../services/token.service";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly cookies: AuthCookiesService,
    private readonly tokens: TokenService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  @Post("register")
  async register(
    @Body(new ZodValidationPipe(registerRequestSchema)) dto: RegisterRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    const context = requestContext(req);
    const user = await this.auth.register(dto);
    const issued = await this.auth.issueTokens(user, context);
    return this.respond(issued, context, res);
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post("login")
  async login(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    const context = requestContext(req);
    const user = req.user as unknown as UserModel;
    const issued = await this.auth.issueTokens(user, context);
    return this.respond(issued, context, res);
  }

  @Public()
  @UseGuards(RefreshTokenGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post("refresh")
  async refresh(
    @RefreshToken() presented: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    const context = requestContext(req);
    const issued = await this.auth.refresh(presented, context);
    return this.respond(issued, context, res);
  }

  @HttpCode(HttpStatus.OK)
  @Post("logout")
  async logout(
    @CurrentUser() principal: Principal,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LogoutResponse> {
    await this.sessions.logout(principal.sessionId);
    this.cookies.clearAuthCookies(res);
    return { success: true };
  }

  @Get("me")
  me(@CurrentUser() principal: Principal): Promise<SessionUser> {
    return this.auth.me(principal);
  }

  @Get("sessions")
  listSessions(
    @CurrentUser() principal: Principal,
  ): Promise<SessionList> {
    return this.sessions.list(principal.userId, principal.sessionId);
  }

  @HttpCode(HttpStatus.OK)
  @Post("sessions/revoke-others")
  async revokeOthers(
    @CurrentUser() principal: Principal,
  ): Promise<LogoutResponse> {
    await this.sessions.revokeOthers(principal.userId, principal.sessionId);
    return { success: true };
  }

  @HttpCode(HttpStatus.OK)
  @Delete("sessions/:publicId")
  async revokeOne(
    @CurrentUser() principal: Principal,
    @Param("publicId") publicId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LogoutResponse> {
    await this.sessions.revokeOne(principal.userId, publicId);
    if (publicId === principal.sessionId) {
      this.cookies.clearAuthCookies(res);
    }
    return { success: true };
  }

  private respond(
    issued: IssuedTokens,
    context: RequestContext,
    res: Response,
  ): LoginResponse {
    if (context.clientType === "mobile") {
      return {
        user: issued.user,
        accessToken: issued.accessToken,
        refreshToken: issued.refreshToken,
        expiresIn: issued.expiresInSeconds,
      };
    }
    this.cookies.setAuthCookies(res, {
      accessToken: issued.accessToken,
      accessMaxAgeMs: this.tokens.accessTtlMilliseconds,
      refreshToken: issued.refreshToken,
      refreshMaxAgeMs: Math.max(
        issued.refreshExpiresAt.getTime() - Date.now(),
        0,
      ),
    });
    return { user: issued.user };
  }
}
