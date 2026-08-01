import { SessionClientType } from "@repo/database/enums";
import type { PlatformRole } from "@repo/database/enums";
import type { Request } from "express";
import { CLIENT_TYPE_HEADER } from "./identity.constants";

export type ClientType = "web" | "mobile";

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  platformRole: PlatformRole;
  typ: "access";
}

export interface RequestContext {
  clientType: ClientType;
  ip: string;
  userAgent: string | null;
}

export function clientTypeFrom(req: Request): ClientType {
  return req.headers[CLIENT_TYPE_HEADER] === "mobile" ? "mobile" : "web";
}

export function requestContext(req: Request): RequestContext {
  const ua = req.headers["user-agent"];
  return {
    clientType: clientTypeFrom(req),
    ip: req.ip ?? "0.0.0.0",
    userAgent: typeof ua === "string" ? ua : null,
  };
}

// The only place the wire-level ClientType becomes the persisted one.
// Everything downstream of session creation must read the stored value, never
// the header, for TTL and ceiling decisions.
export function toSessionClientType(clientType: ClientType): SessionClientType {
  return clientType === "mobile"
    ? SessionClientType.MOBILE
    : SessionClientType.WEB;
}

export function readCookie(req: Request, name: string): string | undefined {
  const cookies = (req as { cookies?: Record<string, unknown> }).cookies;
  const value = cookies?.[name];
  return typeof value === "string" ? value : undefined;
}
