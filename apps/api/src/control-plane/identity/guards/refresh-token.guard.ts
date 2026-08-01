import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { RefreshRequestSchema } from "@repo/contracts/control-plane/identity";
import type { Request } from "express";
import { REFRESH_TOKEN_COOKIE } from "../identity.constants";
import { clientTypeFrom, readCookie } from "../identity.types";

@Injectable()
export class RefreshTokenGuard implements CanActivate {
  // Unlike LocalAuthGuard, a malformed body must not raise
  // ZodValidationException: this route's only failure shape is 401
  // errors.auth.refreshRequired, and a 400 here would change the contract.
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const parsed = RefreshRequestSchema.safeParse(request.body ?? {});
    const presented =
      clientTypeFrom(request) === "web"
        ? readCookie(request, REFRESH_TOKEN_COOKIE)
        : parsed.success
          ? parsed.data.refreshToken
          : undefined;

    if (!presented) {
      throw new UnauthorizedException({ code: "errors.auth.refreshRequired" });
    }

    request.refreshToken = presented;
    return true;
  }
}
