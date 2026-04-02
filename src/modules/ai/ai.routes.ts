import { Router } from "express";

import { asyncHandler } from "../../common/utils/async-handler";
import { validate } from "../../common/middleware/validate.middleware";
import { env } from "../../common/utils/env";
import { logger } from "../../common/utils/logger";
import { aiSearchSchema } from "./ai.validation";

const router = Router();
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

async function normalizeQuery(query: string) {
  if (!env.OPENAI_API_KEY) {
    return query;
  }

  try {
    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        temperature: 0.25,
        max_tokens: 60,
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant that rewrites pickup location queries into concise Mongolian place names or addresses suitable for map search.",
          },
          {
            role: "user",
            content: `Normalize this pickup location query into a single Mongolian location phrase suitable for Mapbox geocoding: "${query}"`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => "<no body>");
      logger.warn("AI search normalization failed", {
        status: response.status,
        statusText: response.statusText,
        body: responseText,
      });
      return query;
    }

    const data = (await response.json().catch((error) => {
      logger.warn("AI normalizeQuery response parse failed", { error });
      return null;
    })) as {
      choices?: Array<{ message?: { content?: string } }>;
    } | null;

    if (!data) {
      return query;
    }

    const content = data.choices?.[0]?.message?.content;

    if (!content || typeof content !== "string") {
      return query;
    }

    return content.trim().replace(/\n+/g, " ");
  } catch (error) {
    logger.warn("AI search request failed", { error });
    return query;
  }
}

router.post(
  "/search",
  validate({ body: aiSearchSchema }),
  asyncHandler(async (request, response) => {
    const { query } = request.body;
    const normalizedQuery = await normalizeQuery(query);

    response.json({ normalizedQuery });
  }),
);

export default router;
