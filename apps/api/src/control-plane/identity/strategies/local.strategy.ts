import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import type { UserModel } from "@repo/database/models";
import type { Request } from "express";
import { Strategy } from "passport-local";
import { AuthService } from "../services/auth.service";
import { loginRequestSchema } from "../dto/login.schema";

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      usernameField: "method",
      passwordField: "password",
      passReqToCallback: true,
    });
  }

  async validate(req: Request): Promise<UserModel> {
    const dto = loginRequestSchema.parse(req.body);
    return this.authService.validateCredentials(dto);
  }
}
