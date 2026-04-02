import { Router } from "express";

import { categoriesService } from "./categories.service";

const router = Router();

router.get("/", (_request, response) => {
  response.json(categoriesService.getAll());
});

export default router;
