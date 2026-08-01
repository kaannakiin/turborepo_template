import { DeviceType } from "@repo/database/enums";
import type { PrismaService } from "@api/prisma/prisma.service";
import { DeviceService } from "@api/control-plane/identity/services/device.service";

const CHROME_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPAD_SAFARI =
  "Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1";
const GOOGLEBOT =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

describe("DeviceService", () => {
  const service = new DeviceService({} as PrismaService);

  describe("parse", () => {
    it.each([
      [CHROME_MAC, DeviceType.DESKTOP],
      [IPHONE_SAFARI, DeviceType.MOBILE],
      [IPAD_SAFARI, DeviceType.TABLET],
      [GOOGLEBOT, DeviceType.BOT],
      ["curl/8.6.0", DeviceType.BOT],
    ])("classifies %s", (ua, expected) => {
      expect(service.parse(ua).deviceType).toBe(expected);
    });

    it("returns UNKNOWN with null fields for a missing UA", () => {
      expect(service.parse(null)).toEqual({
        deviceType: DeviceType.UNKNOWN,
        osName: null,
        osVersion: null,
        browserName: null,
        browserVersion: null,
      });
    });

    it("extracts os and browser names", () => {
      const parsed = service.parse(CHROME_MAC);
      expect(parsed.osName).toBe("macOS");
      expect(parsed.browserName).toBe("Chrome");
    });
  });

  describe("fingerprint", () => {
    it("ignores browser patch releases", () => {
      const a = service.fingerprint(1n, service.parse(CHROME_MAC));
      const b = service.fingerprint(
        1n,
        service.parse(
          CHROME_MAC.replace("Chrome/126.0.0.0", "Chrome/126.0.1.5"),
        ),
      );
      expect(a).toBe(b);
      expect(a).toHaveLength(64);
    });

    it("changes when the user or device type changes", () => {
      const parsed = service.parse(CHROME_MAC);
      expect(service.fingerprint(1n, parsed)).not.toBe(
        service.fingerprint(2n, parsed),
      );
      expect(service.fingerprint(1n, parsed)).not.toBe(
        service.fingerprint(1n, service.parse(IPHONE_SAFARI)),
      );
    });
  });
});
