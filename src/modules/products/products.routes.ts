import { Router } from "express";

import { validate } from "../../common/middleware/validate.middleware";
import { asyncHandler } from "../../common/utils/async-handler";
import { productsService } from "./products.service";
import { productSlugParamSchema } from "./products.validation";

const router = Router();

router.get(
  "/",
  asyncHandler(async (_request, response) => {
    response.json(await productsService.listPublic());
  }),
);

router.get(
  "/:slug",
  validate(productSlugParamSchema),
  asyncHandler(async (request, response) => {
    response.json(await productsService.getPublicBySlug(request.params.slug as string));
  }),
);

export default router;
