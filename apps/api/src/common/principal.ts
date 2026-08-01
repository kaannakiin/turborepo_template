import type { PlatformRole } from "@repo/database/enums";

export interface Principal {
  userId: string;
  sessionId: string;
  platformRole: PlatformRole;
}
