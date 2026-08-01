import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

export const RefreshToken = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.refreshToken as string;
  },
);
