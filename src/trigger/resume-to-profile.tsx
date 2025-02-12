import { logger, schemaTask } from "@trigger.dev/sdk/v3"
import axios from "axios"
import { z } from "zod"

const resumeToProfileSchema = z.object({
  name: z.string(),
  resume_url: z.string().url(),
})

const dify_key = process.env.RESUME_TO_PROFILE_KEY

export const resumeToProfile = schemaTask({
  id: "resume-to-profile",
  retry: {
    maxAttempts: 5,
    factor: 1.5,
    randomize: true,
  },
  maxDuration: 300,
  schema: resumeToProfileSchema,

  run: async (payload) => {
    if (!dify_key) {
      logger.error("DIFY_KEY is not set in the environment")
    }

    logger.log("Resume to profile task started", { payload })

    // Placeholder for the actual implementation
    const res = await generateResumeData(payload.resume_url)

    logger.log("Generated profile", { res })

    return res
  },
})

async function generateResumeData(resume_url: string) {
  const data = {
    inputs: {
      resume: {
        transfer_method: "remote_url",
        url: resume_url,
        type: "document",
      },
    },
    response_mode: "blocking",
    user: "trigger",
  }

  try {
    const response = await axios.post(
      "https://dify.xcelerator.co.in/v1/workflows/run",
      data,
      {
        headers: {
          Authorization: `Bearer ${dify_key}`,
          "Content-Type": "application/json",
        },
      }
    )
    return response.data
  } catch (error) {
    logger.error("Error making API call", { error })
    throw error
  }
}
