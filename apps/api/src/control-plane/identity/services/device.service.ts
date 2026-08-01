import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { DeviceType } from "@repo/database/enums";
import type { UserDeviceModel } from "@repo/database/models";
import Bowser from "bowser";
import { isUniqueViolation } from "../../../common/prisma-errors";
import { PrismaService } from "../../../prisma/prisma.service";

export interface ParsedDevice {
  deviceType: DeviceType;
  osName: string | null;
  osVersion: string | null;
  browserName: string | null;
  browserVersion: string | null;
}

const BOT_UA_PATTERN = /bot|crawler|spider|slurp|curl\/|wget\//i;

const PLATFORM_TO_DEVICE_TYPE: Record<string, DeviceType> = {
  desktop: DeviceType.DESKTOP,
  mobile: DeviceType.MOBILE,
  tablet: DeviceType.TABLET,
};

@Injectable()
export class DeviceService {
  constructor(private readonly prisma: PrismaService) {}

  parse(userAgent: string | null): ParsedDevice {
    if (!userAgent || userAgent.trim() === "") {
      return {
        deviceType: DeviceType.UNKNOWN,
        osName: null,
        osVersion: null,
        browserName: null,
        browserVersion: null,
      };
    }

    const parsed = Bowser.parse(userAgent);
    const deviceType = BOT_UA_PATTERN.test(userAgent)
      ? DeviceType.BOT
      : (PLATFORM_TO_DEVICE_TYPE[parsed.platform.type ?? ""] ??
        DeviceType.UNKNOWN);

    return {
      deviceType,
      osName: parsed.os.name ?? null,
      osVersion: parsed.os.version ?? null,
      browserName: parsed.browser.name ?? null,
      browserVersion: parsed.browser.version ?? null,
    };
  }

  fingerprint(userId: bigint, parsed: ParsedDevice): string {
    const osMajor = (parsed.osVersion ?? "").split(".")[0] ?? "";
    return createHash("sha256")
      .update(
        `${userId}|${parsed.osName ?? ""}|${osMajor}|${parsed.browserName ?? ""}|${parsed.deviceType}`,
      )
      .digest("hex");
  }

  async upsertForLogin(
    userId: bigint,
    userAgent: string | null,
  ): Promise<UserDeviceModel> {
    const parsed = this.parse(userAgent);
    const fingerprint = this.fingerprint(userId, parsed);
    const now = new Date();

    const create = {
      userId,
      fingerprint,
      deviceType: parsed.deviceType,
      osName: parsed.osName,
      osVersion: parsed.osVersion,
      browserName: parsed.browserName,
      browserVersion: parsed.browserVersion,
      lastSeenAt: now,
    };
    const update = {
      lastSeenAt: now,
      osVersion: parsed.osVersion,
      browserVersion: parsed.browserVersion,
    };
    const where = { userId_fingerprint: { userId, fingerprint } };

    try {
      return await this.prisma.userDevice.upsert({ where, create, update });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      return this.prisma.userDevice.update({ where, data: update });
    }
  }
}
