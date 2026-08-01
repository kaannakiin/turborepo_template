import { createZodDto } from "nestjs-zod";
import { CreateUserSchema, UpdateUserSchema } from "@repo/contracts/control-plane/platform";

/**
 * DTOs are derived from the shared Zod contract — never redeclared.
 * ZodValidationPipe (registered globally) validates against these schemas, and
 * `platformRole` is constrained to the Prisma enum through the contract.
 */
export class CreateUserDto extends createZodDto(CreateUserSchema) {}

export class UpdateUserDto extends createZodDto(UpdateUserSchema) {}
