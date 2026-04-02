import { z } from "zod";

export const productSlugParamSchema = {
  params: z.object({
    slug: z.string().min(1),
  }),
};
