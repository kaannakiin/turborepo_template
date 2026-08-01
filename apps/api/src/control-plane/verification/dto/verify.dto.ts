import { VerifyConfirmSchema, VerifyRequestSchema } from "@repo/contracts/control-plane/identity";
import { createZodDto } from "nestjs-zod";

export class VerifyRequestDto extends createZodDto(VerifyRequestSchema) {}

export class VerifyConfirmDto extends createZodDto(VerifyConfirmSchema) {}
