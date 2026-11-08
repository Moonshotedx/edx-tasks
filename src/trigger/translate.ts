import { logger, schemaTask } from "@trigger.dev/sdk"
import { z } from "zod"

import { chat } from "../lib/makima"

export const generateTranslationsTask = schemaTask({
  id: "translate",
  retry: {
    maxAttempts: 5,
    factor: 1.5,
    randomize: true,
  },
  schema: z.object({
    text: z.string(),
    dialect: z.string().optional(),
    language: z.string(),
  }),

  run: async (payload) => {
    logger.log("Payload", { payload })
    const res = await chat({
      agent: "general",
      content: `You need to translate the given text
Target Language:
${payload.language}
Dialect:
${payload.dialect || "Standard"}


Text to translate:
---
${payload.text}
---

The response muyst be in the following format:
{
  translation: string
}
`,
      name: "user",
    })

    logger.log("Raw response", { res })

    // validate the response;
    const responseSchema = z.object({
      translation: z.string(),
    })

    const jsonParsed = JSON.parse(res)

    const parsedOutput = responseSchema.parse(jsonParsed)

    return parsedOutput
  },
})
