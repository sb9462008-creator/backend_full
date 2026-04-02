import { prisma } from "../../prisma/client";
import { ApiError } from "./api-error";
import { env } from "./env";

export async function getStorefrontTenant() {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: env.STOREFRONT_TENANT_SLUG },
  });

  if (!tenant) {
    throw new ApiError(500, "Storefront tenant is not configured");
  }

  return tenant;
}
