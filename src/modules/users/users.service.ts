import { UserRole } from "@prisma/client";

import { prisma } from "../../prisma/client";
import { ApiError } from "../../common/utils/api-error";
import { normalizeEmail } from "../../common/utils/normalization";
import { hashPassword } from "../../common/utils/password";

const userSelect = {
  id: true,
  tenantId: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  tenant: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  createdAt: true,
  updatedAt: true,
} as const;

export class UsersService {
  async list(tenantId: string) {
    return prisma.user.findMany({
      where: { tenantId },
      select: userSelect,
      orderBy: { createdAt: "desc" },
    });
  }

  async getById(tenantId: string, id: string) {
    const user = await prisma.user.findFirst({
      where: { tenantId, id },
      select: userSelect,
    });

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    return user;
  }

  async create(
    tenantId: string,
    input: {
      name: string;
      email: string;
      password: string;
      role: string;
      isActive?: boolean;
    },
  ) {
    const normalizedEmail = normalizeEmail(input.email);

    const existing = await prisma.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: "insensitive",
        },
      },
    });

    if (existing) {
      throw new ApiError(409, "Email is already in use");
    }

    return prisma.user.create({
      data: {
        tenantId,
        name: input.name.trim(),
        email: normalizedEmail,
        passwordHash: await hashPassword(input.password),
        role: input.role as UserRole,
        isActive: input.isActive ?? true,
      },
      select: userSelect,
    });
  }

  async update(
    tenantId: string,
    id: string,
    input: {
      name?: string;
      email?: string;
      password?: string;
      role?: string;
      isActive?: boolean;
    },
  ) {
    await this.getById(tenantId, id);

    if (input.email) {
      const normalizedEmail = normalizeEmail(input.email);
      const existing = await prisma.user.findFirst({
        where: {
          id: { not: id },
          email: {
            equals: normalizedEmail,
            mode: "insensitive",
          },
        },
      });

      if (existing) {
        throw new ApiError(409, "Email is already in use");
      }
    }

    return prisma.user.update({
      where: { id },
      data: {
        name: input.name?.trim(),
        email: input.email ? normalizeEmail(input.email) : undefined,
        passwordHash: input.password ? await hashPassword(input.password) : undefined,
        role: input.role as UserRole | undefined,
        isActive: input.isActive,
      },
      select: userSelect,
    });
  }

  async delete(tenantId: string, id: string) {
    await this.getById(tenantId, id);
    await prisma.user.delete({
      where: { id },
    });

    return { success: true };
  }
}

export const usersService = new UsersService();
