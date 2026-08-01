export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";

// Scoped to the one endpoint that consumes it: the browser never sends the
// long-lived credential anywhere else on the site.
export const REFRESH_COOKIE_PATH = "/auth/refresh";

// Response-format selector only, never an authorization signal: both
// transports carry identical privileges, so spoofing it gains nothing.
export const CLIENT_TYPE_HEADER = "x-client-type";

// Concurrent refreshes from a shared cookie jar (multiple tabs) present the
// pre-rotation token within moments of each other. Inside this window a
// previousTokenHash hit is a benign race; outside it, a replayed stolen token.
export const REFRESH_REUSE_GRACE_MS = 10_000;

// Soft cap; the oldest session is evicted on overflow. SessionRevokeReason has
// no value for policy eviction, so evicted rows keep revokeReason NULL.
export const SESSION_CAP = 10;

// Sliding refresh expiry is bounded to createdAt + TTL * this multiplier so a
// continuously-refreshed (or stolen) session still has an absolute end.
export const REFRESH_CEILING_MULTIPLIER = 3;
