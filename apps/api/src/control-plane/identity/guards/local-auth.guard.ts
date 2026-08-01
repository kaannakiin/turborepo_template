import { Injectable, type ExecutionContext } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { Request } from "express";
import { ZodValidationException } from "nestjs-zod";
import { loginRequestSchema } from "../dto/login.schema";

@Injectable()
export class LocalAuthGuard extends AuthGuard("local") {
  // Guards run before the global ZodValidationPipe, so a malformed login body
  // has to be rejected here with the same ZodValidationException the pipe
  // would raise — otherwise login would be the one endpoint whose validation
  // errors diverge from the shared error contract.
  override canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const result = loginRequestSchema.safeParse(request.body);
    if (!result.success) throw new ZodValidationException(result.error);
    return super.canActivate(context);
  }
}
