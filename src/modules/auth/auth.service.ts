import { UserRole } from "@prisma/client";

import { prisma } from "../../prisma/client";
import { ApiError } from "../../common/utils/api-error";
import { signToken } from "../../common/utils/jwt";
import { env } from "../../common/utils/env";
import { logger } from "../../common/utils/logger";
import { sendMail } from "../../common/utils/mailer";
import { normalizeEmail } from "../../common/utils/normalization";
import { comparePassword, hashPassword } from "../../common/utils/password";
import { getStorefrontTenant } from "../../common/utils/storefront";
import type { AuthUser } from "../../common/types/auth";

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

export class AuthService {
  private async sendWelcomeEmail(input: {
    email: string;
    name: string;
    storefrontName: string;
  }) {
    const storefrontUrl = env.FRONTEND_URL ?? "https://localhost:3000";
    const trackingUrl = `${storefrontUrl}/track`;
    const ordersUrl = `${storefrontUrl}/orders`;
    const shopUrl = `${storefrontUrl}/shop`;

    await sendMail({
      to: input.email,
      subject: `Welcome to ${input.storefrontName}`,
      text: [
        `Hi ${input.name},`,
        "",
        `Welcome to ${input.storefrontName}. Your account has been created successfully.`,
        "",
        "What you can do next:",
        `- Browse computer parts, monitors, accessories, and full PC builds: ${shopUrl}`,
        `- Sign in and manage your orders: ${ordersUrl}`,
        `- Track your deliveries anytime: ${trackingUrl}`,
        "",
        "If you did not create this account, please contact support immediately.",
      ].join("\n"),
      html: `
        <div style="font-family: Arial, sans-serif; color: #111111; line-height: 1.6;">
          <h2 style="margin-bottom: 12px;">Welcome to ${input.storefrontName}</h2>
          <p>Hi ${input.name},</p>
          <p>Your account has been created successfully.</p>
          <p>You can now:</p>
          <ul>
            <li><a href="${shopUrl}">Browse computer parts, monitors, accessories, and full PC builds</a></li>
            <li><a href="${ordersUrl}">Sign in and manage your orders</a></li>
            <li><a href="${trackingUrl}">Track deliveries anytime</a></li>
          </ul>
          <p>If you did not create this account, please contact support immediately.</p>
        </div>
      `,
    });
  }

  private buildAuthResponse(result: {
    id: string;
    tenantId: string;
    name: string;
    email: string;
    role: UserRole;
    isActive: boolean;
    tenant: {
      id: string;
      name: string;
      slug: string;
    };
  }) {
    const authUser: AuthUser = {
      userId: result.id,
      tenantId: result.tenantId,
      email: result.email,
      role: result.role,
    };

    return {
      user: result,
      accessToken: signToken(authUser),
    };
  }

  async register(input: {
    name: string;
    email: string;
    password: string;
  }) {
    const normalizedEmail = normalizeEmail(input.email);

    const existingUser = await prisma.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: "insensitive",
        },
      },
    });

    if (existingUser) {
      throw new ApiError(409, "Email is already in use");
    }

    const storefrontTenant = await getStorefrontTenant();

    const result = await prisma.user.create({
      data: {
        tenantId: storefrontTenant.id,
        name: input.name.trim(),
        email: normalizedEmail,
        passwordHash: await hashPassword(input.password),
        role: UserRole.CUSTOMER,
      },
      select: userSelect,
    });

    void this.sendWelcomeEmail({
      email: result.email,
      name: result.name,
      storefrontName: storefrontTenant.name,
    }).catch((error) => {
      logger.exception("Failed to send welcome email after customer registration", error, {
        userId: result.id,
        email: result.email,
      });
    });

    return this.buildAuthResponse(result);
  }

  async registerDriver(input: {
    name: string;
    email: string;
    phone: string;
    password: string;
  }) {
    const normalizedEmail = normalizeEmail(input.email);

    const existingUser = await prisma.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: "insensitive",
        },
      },
    });

    if (existingUser) {
      throw new ApiError(409, "Email is already in use");
    }

    const storefrontTenant = await getStorefrontTenant();

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          tenantId: storefrontTenant.id,
          name: input.name.trim(),
          email: normalizedEmail,
          passwordHash: await hashPassword(input.password),
          role: UserRole.DRIVER,
        },
      });

      await tx.driver.create({
        data: {
          tenantId: storefrontTenant.id,
          userId: user.id,
          name: input.name.trim(),
          phone: input.phone.trim(),
          status: "AVAILABLE",
        },
      });

      return tx.user.findUniqueOrThrow({
        where: { id: user.id },
        select: userSelect,
      });
    });

    void this.sendWelcomeEmail({
      email: result.email,
      name: result.name,
      storefrontName: storefrontTenant.name,
    }).catch((error) => {
      logger.exception("Failed to send welcome email after driver registration", error, {
        userId: result.id,
        email: result.email,
      });
    });

    return this.buildAuthResponse(result);
  }

  async login(input: { email: string; password: string }) {
    const normalizedEmail = normalizeEmail(input.email);

    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: "insensitive",
        },
      },
      include: {
        tenant: true,
      },
    });

    if (!user || !(await comparePassword(input.password, user.passwordHash))) {
      throw new ApiError(401, "Invalid credentials");
    }

    if (!user.isActive) {
      throw new ApiError(403, "User account is inactive");
    }

    return this.buildAuthResponse(
      await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        select: userSelect,
      }),
    );
  }

  async me(userId: string, tenantId: string) {
    return prisma.user.findFirstOrThrow({
      where: {
        id: userId,
        tenantId,
      },
      select: userSelect,
    });
  }
}

export const authService = new AuthService();
