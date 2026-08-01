import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import type { Env } from "../../config/env.schema";
import { AuthController } from "./controllers/auth.controller";
import { AuthCookiesService } from "./services/auth-cookies.service";
import { AuthService } from "./services/auth.service";
import { DeviceService } from "./services/device.service";
import { PasswordService } from "./services/password.service";
import { SessionService } from "./services/session.service";
import { TokenService } from "./services/token.service";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { LocalStrategy } from "./strategies/local.strategy";

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get("JWT_SECRET", { infer: true }),
        signOptions: {
          expiresIn: config.get("JWT_ACCESS_TTL", { infer: true }),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthCookiesService,
    DeviceService,
    PasswordService,
    SessionService,
    TokenService,
    LocalStrategy,
    JwtStrategy,
  ],
  exports: [PasswordService],
})
export class IdentityModule {}
