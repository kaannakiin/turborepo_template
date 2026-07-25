import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CreateUser, UpdateUser, User } from '@repo/contracts/admin';
import type { UserModel } from '@repo/database/models';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<User[]> {
    const rows = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toContract);
  }

  async findOne(id: string): Promise<User> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`User ${id} not found`);
    return toContract(row);
  }

  async create(input: CreateUser): Promise<User> {
    try {
      const row = await this.prisma.user.create({ data: input });
      return toContract(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`Email ${input.email} is already taken`);
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateUser): Promise<User> {
    try {
      const row = await this.prisma.user.update({ where: { id }, data: input });
      return toContract(row);
    } catch (error) {
      if (isNotFound(error)) {
        throw new NotFoundException(`User ${id} not found`);
      }
      if (isUniqueViolation(error)) {
        throw new ConflictException('Email is already taken');
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await this.prisma.user.delete({ where: { id } });
    } catch (error) {
      if (isNotFound(error)) {
        throw new NotFoundException(`User ${id} not found`);
      }
      throw error;
    }
  }
}

/**
 * DB row -> wire type. This function is the entire reason the contract is not
 * simply `UserModel`: Postgres hands back `createdAt` as a `Date`, JSON can
 * only carry a string. Every value crossing the wire converts here.
 */
function toContract(row: UserModel): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Prisma error codes are matched structurally instead of by importing
 * `PrismaClientKnownRequestError` — that class lives behind
 * `@prisma/client/runtime`, which this app does not reach into directly.
 */
function hasPrismaCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === code
  );
}

const isUniqueViolation = (error: unknown): boolean =>
  hasPrismaCode(error, 'P2002');

const isNotFound = (error: unknown): boolean => hasPrismaCode(error, 'P2025');
