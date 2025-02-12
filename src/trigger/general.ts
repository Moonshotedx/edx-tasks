import { logger, schemaTask } from "@trigger.dev/sdk/v3"
import { z } from "zod"
import zodToJsonSchema from "zod-to-json-schema"

import { chat } from "../lib/makima"

const profileSummaryResponseSchema = z.object({
  highlights: z.array(z.string()).max(3),
  points: z.array(z.string()).max(3),
})

const promptSchema = JSON.stringify(
  zodToJsonSchema(profileSummaryResponseSchema),
  null,
  2
)

export const generateProfileSummary = schemaTask({
  id: "profile-summary",
  retry: {
    maxAttempts: 5,
    factor: 1.5,
    randomize: true,
  },
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 300, // Stop executing after 300 secs (5 mins) of compute
  schema: z.object({
    name: z.string(),
    experience: z.any(),
  }),

  run: async (payload) => {
    logger.log("reached here")

    const res = await chat({
      agent: "general",
      content: `Hey need help with generating a summary of my profile.

Here is my current profile:
${JSON.stringify(payload, null, 2)}

If the above profile does not have detailed enough information, please add message for the user to fill their profile to get better summaries.

Do not make up any information, only use the information provided in the profile, if not enough information is provided, ask the user to provide more information.

The response must follow the following JSON schema:
\`\`\`
${promptSchema}
\`\`\`
`,
      name: payload.name,
    })

    console.log("here")

    logger.log("Raw response", { res })

    const parsedOutput = JSON.parse(res)

    const validParsedOutput = profileSummaryResponseSchema.parse(parsedOutput)

    return validParsedOutput
  },
})
