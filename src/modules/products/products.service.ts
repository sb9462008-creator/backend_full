import { prisma } from "../../prisma/client";
import { ApiError } from "../../common/utils/api-error";
import { getStorefrontTenant } from "../../common/utils/storefront";

const productSelect = {
  id: true,
  tenantId: true,
  name: true,
  slug: true,
  sku: true,
  category: true,
  brand: true,
  description: true,
  priceCents: true,
  imageUrl: true,
  stock: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

export class ProductsService {
  async listPublic() {
    const storefrontTenant = await getStorefrontTenant();

    return prisma.product.findMany({
      where: {
        tenantId: storefrontTenant.id,
        isActive: true,
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: productSelect,
    });
  }

  async getPublicBySlug(slug: string) {
    const storefrontTenant = await getStorefrontTenant();

    const product = await prisma.product.findFirst({
      where: {
        tenantId: storefrontTenant.id,
        slug,
        isActive: true,
      },
      select: productSelect,
    });

    if (!product) {
      throw new ApiError(404, "Product not found");
    }

    return product;
  }
}

export const productsService = new ProductsService();
