import { UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import { REFRESH_TOKEN_COOKIE } from "@api/control-plane/identity/identity.constants";
import { RefreshTokenGuard } from "@api/control-plane/identity/guards/refresh-token.guard";

function requestFor(overrides: {
  clientType?: "web" | "mobile";
  cookies?: Record<string, unknown>;
  body?: unknown;
}): Request {
  return {
    headers:
      overrides.clientType === "mobile" ? { "x-client-type": "mobile" } : {},
    cookies: overrides.cookies ?? {},
    body: overrides.body ?? {},
  } as unknown as Request;
}

function contextFor(request: Request): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe("RefreshTokenGuard", () => {
  const guard = new RefreshTokenGuard();

  it("takes the token from the cookie for web clients", () => {
    const request = requestFor({
      cookies: { [REFRESH_TOKEN_COOKIE]: "cookie-token" },
    });

    expect(guard.canActivate(contextFor(request))).toBe(true);
    expect(request.refreshToken).toBe("cookie-token");
  });

  it("takes the token from the body for mobile clients", () => {
    const request = requestFor({
      clientType: "mobile",
      body: { refreshToken: "body-token" },
    });

    expect(guard.canActivate(contextFor(request))).toBe(true);
    expect(request.refreshToken).toBe("body-token");
  });

  it("ignores a body token when the client is web", () => {
    const request = requestFor({ body: { refreshToken: "body-token" } });

    expect(() => guard.canActivate(contextFor(request))).toThrow(
      UnauthorizedException,
    );
  });

  it("ignores the cookie when the client is mobile", () => {
    const request = requestFor({
      clientType: "mobile",
      cookies: { [REFRESH_TOKEN_COOKIE]: "cookie-token" },
    });

    expect(() => guard.canActivate(contextFor(request))).toThrow(
      UnauthorizedException,
    );
  });

  it("rejects a web request with no cookie", () => {
    expect(() => guard.canActivate(contextFor(requestFor({})))).toThrow(
      UnauthorizedException,
    );
  });

  it("reports a missing credential as errors.auth.refreshRequired", () => {
    try {
      guard.canActivate(contextFor(requestFor({})));
      throw new Error("guard should have rejected");
    } catch (error) {
      expect(error).toMatchObject({
        response: { code: "errors.auth.refreshRequired" },
      });
    }
  });

  it("treats a malformed mobile body as absent, not a validation error", () => {
    const request = requestFor({
      clientType: "mobile",
      body: { refreshToken: 42 },
    });

    expect(() => guard.canActivate(contextFor(request))).toThrow(
      UnauthorizedException,
    );
  });
});
