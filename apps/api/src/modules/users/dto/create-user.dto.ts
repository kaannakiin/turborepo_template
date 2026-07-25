import { createZodDto } from 'nestjs-zod';
import { CreateUserSchema } from '@repo/contracts';

/**
 * DTOs are derived from the shared Zod contract — never redeclared.
 * ZodValidationPipe (registered globally) validates against this schema.
 */
export class CreateUserDto extends createZodDto(CreateUserSchema) {}
