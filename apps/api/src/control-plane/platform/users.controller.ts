import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import type { User } from "@repo/contracts/control-plane/platform";
import { PlatformRole } from "@repo/database/enums";
import { Roles } from "../../common/decorators/roles.decorator";
import { CreateUserDto, UpdateUserDto } from "./dto/create-user.dto";
import { UsersService } from "./users.service";

// Prefixed because a tenant's own member list is a different resource with a
// different guard; `/users` alone would not say which one this is.
@Roles(PlatformRole.SUPERADMIN)
@Controller("platform/users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(): Promise<User[]> {
    return this.usersService.findAll();
  }

  @Get(":publicId")
  findOne(@Param("publicId") publicId: string): Promise<User> {
    return this.usersService.findOne(publicId);
  }

  @Post()
  create(@Body() dto: CreateUserDto): Promise<User> {
    return this.usersService.create(dto);
  }

  @Patch(":publicId")
  update(
    @Param("publicId") publicId: string,
    @Body() dto: UpdateUserDto,
  ): Promise<User> {
    return this.usersService.update(publicId, dto);
  }

  @Delete(":publicId")
  @HttpCode(204)
  remove(@Param("publicId") publicId: string): Promise<void> {
    return this.usersService.remove(publicId);
  }
}
