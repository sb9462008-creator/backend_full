import { z } from "zod";

export const aiSearchSchema = z.object({
  query: z.string().min(1),
});
