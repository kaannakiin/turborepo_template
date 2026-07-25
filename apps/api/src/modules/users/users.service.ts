import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { CreateUser, User } from '@repo/contracts';

@Injectable()
export class UsersService {
  // In-memory store — replace with a repository backed by a real database.
  private readonly users = new Map<string, User>();

  findAll(): User[] {
    return [...this.users.values()];
  }

  findOne(id: string): User {
    const user = this.users.get(id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  create(input: CreateUser): User {
    const user: User = {
      id: randomUUID(),
      email: input.email,
      name: input.name,
      createdAt: new Date().toISOString(),
    };
    this.users.set(user.id, user);
    return user;
  }
}
