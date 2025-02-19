/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { logger, schemaTask } from "@trigger.dev/sdk/v3"
import axios from "axios"
import { z } from "zod"

const resumeToProfileSchema = z.object({
  name: z.string(),
  resume_url: z.string().url(),
  existing_experiences: z.array(z.any()).optional(),
})

const dify_key = process.env.RESUME_TO_PROFILE_KEY

export const resumeToProfileGenerator = schemaTask({
  id: "resume-to-profile",
  retry: {
    maxAttempts: 3,
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
    const res = await generateResumeData(
      payload.resume_url,
      payload.existing_experiences
    )

    logger.log("Generated profile", { res })

    return res
  },
})

interface Profile {
  experiences: Array<{
    id: number
    title: string
    organisation: string
    type: string
    description: string
    location: string
    start_date: string
    end_date: string
    is_ongoing: boolean
    link: string
    skills: string[]
    order: number
  }>
}

interface ApiResponse {
  task_id: string
  workflow_run_id: string
  data: {
    id: string
    workflow_id: string
    status: string
    outputs: {
      profile: string
    }
    error: null | string
    elapsed_time: number
    total_tokens: number
    total_steps: number
    created_at: number
    finished_at: number
  }
}

async function generateResumeData(
  resume_url: string,
  existing_experiences?: any[]
): Promise<{ profile: Profile }> {
  const data = {
    inputs: {
      resume: {
        transfer_method: "remote_url",
        url: resume_url,
        type: "document",
      },
      existing_experiences: JSON.stringify(existing_experiences || []),
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
    logger.log("API call successful", { response: response.data })
    const apiResponse: ApiResponse = response.data
    const profile: Profile = JSON.parse(apiResponse.data.outputs.profile)
    return { profile }
  } catch (error) {
    logger.error("Error making API call", { error })
    throw error
  }
}
