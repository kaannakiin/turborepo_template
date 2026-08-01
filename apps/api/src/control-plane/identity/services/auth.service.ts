import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import type {
  LoginRequest,
  RegisterRequest,
  SessionUser,
} from "@repo/contracts/control-plane/identity";
import { UserStatus } from "@repo/database/enums";
import type { UserModel } from "@repo/database/models";
import { toE164 } from "@repo/utils/phone";
import { uniqueViolationTargets } from "../../../common/prisma-errors";
import { PrismaService } from "../../../prisma/prisma.service";
import type { Principal } from "../../../common/principal";
import type { RequestContext } from "../identity.types";
import { DeviceService } from "./device.service";
import { PasswordService } from "./password.service";
import { SessionService } from "./session.service";
import { TokenService } from "./token.service";

export interface IssuedTokens {
  user: SessionUser;
  accessToken: string;
  expiresInSeconds: number;
  refreshToken: string;
  refreshExpiresAt: Date;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly sessions: SessionService,
    private readonly devices: DeviceService,
  ) {}

  async register(dto: RegisterRequest): Promise<UserModel> {
    const passwordHash = await this.passwords.hash(dto.password);
    const base = { passwordHash, name: dto.name, surname: dto.surname };
    const data =
      dto.method === "email"
        ? { ...base, email: dto.email }
        : { ...base, phone: toE164(dto.phone) ?? dto.phone };

    try {
      return await this.prisma.user.create({ data });
    } catch (error) {
      const targets = uniqueViolationTargets(error);
      if (targets.includes("email")) {
        throw new ConflictException({ code: "errors.auth.emailTaken" });
      }
      if (targets.includes("phone")) {
        throw new ConflictException({ code: "errors.auth.phoneTaken" });
      }
      throw error;
    }
  }

  async validateCredentials(dto: LoginRequest): Promise<UserModel> {
    const identifier =
      dto.method === "email"
        ? { email: dto.email }
        : { phone: toE164(dto.phone) ?? dto.phone };

    const user = await this.prisma.user.findFirst({
      where: { ...identifier, deletedAt: null },
    });

    if (!user) {
      await this.passwords.verifyDummy(dto.password);
      throw invalidCredentials();
    }

    const valid = await this.passwords.verify(user.passwordHash, dto.password);
    if (!valid) throw invalidCredentials();

    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException({ code: "errors.auth.accountSuspended" });
    }

    if (this.passwords.needsRehash(user.passwordHash)) {
      try {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { passwordHash: await this.passwords.hash(dto.password) },
        });
      } catch (error) {
        this.logger.warn("Rehash-on-login write failed", error);
      }
    }

    return user;
  }

  async issueTokens(
    user: UserModel,
    context: RequestContext,
  ): Promise<IssuedTokens> {
    const device = await this.devices.upsertForLogin(
      user.id,
      context.userAgent,
    );
    const { session, refreshToken } = await this.sessions.create({
      userId: user.id,
      deviceId: device.id,
      context,
    });
    const access = await this.tokens.signAccessToken(user, session.publicId);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      user: toSessionUser(user),
      accessToken: access.token,
      expiresInSeconds: access.expiresInSeconds,
      refreshToken,
      refreshExpiresAt: session.expiresAt,
    };
  }

  async refresh(
    presentedToken: string,
    context: RequestContext,
  ): Promise<IssuedTokens> {
    const rotated = await this.sessions.rotate(presentedToken, context);
    const access = await this.tokens.signAccessToken(
      rotated.user,
      rotated.sessionPublicId,
    );

    return {
      user: toSessionUser(rotated.user),
      accessToken: access.token,
      expiresInSeconds: access.expiresInSeconds,
      refreshToken: rotated.refreshToken,
      refreshExpiresAt: rotated.refreshExpiresAt,
    };
  }

  async me(principal: Principal): Promise<SessionUser> {
    const user = await this.prisma.user.findFirst({
      where: { publicId: principal.userId, deletedAt: null },
    });
    if (!user) {
      throw new UnauthorizedException({ code: "errors.auth.unauthorized" });
    }
    return toSessionUser(user);
  }
}

const invalidCredentials = (): UnauthorizedException =>
  new UnauthorizedException({ code: "errors.auth.invalidCredentials" });

function toSessionUser(user: UserModel): SessionUser {
  return {
    publicId: user.publicId,
    email: user.email,
    phone: user.phone,
    name: user.name,
    surname: user.surname,
    platformRole: user.platformRole,
    status: user.status,
  };
}
